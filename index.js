/**
 * dsh-clear-conversation: clear the conversation context in DeepSeek Harness.
 * - Tool `clear_conversation`: the model calls it when the user explicitly asks.
 * - Command `/clear`: the user clears everything while the agent is idle (Web and SDK surfaces).
 * The Web card for `/clear` lives in lib/client.js.
 */

import { readFileSync } from 'node:fs'

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'

import { clearedPrompts, commitClear, formatClearSummary, planClear, releasedTokens } from './clear.js'
import { startUpdateCheck } from './update.js'

export const name = 'clear-conversation'
export const inject = ['tools', 'tokenMeter']

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const updates = startUpdateCheck(version)

const DESCRIPTION = [
  'Clear the conversation context: earlier messages stay in the transcript but are no longer sent to you.',
  "Call ONLY when the user's current message explicitly asks to clear, reset or forget the conversation above, or to start over (any language).",
  'Never call it for casual uses of "clear" or "forget", questions about this feature, quoted or pasted text, or vague requests like "let\'s move on".',
  'Never call it on your own initiative.',
  'Call it before answering the rest of the message, then follow the instruction in its result.'
].join(' ')

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['cleared', 'nothing_to_clear', 'unavailable'], required: true },
    clearedMessages: { type: 'integer' },
    releasedTokens: { type: 'integer' },
    instruction: { type: 'string', required: true }
  }
}

/** Run one clear on a live agent; shared by the tool and the command. */
function clearAgent(ctx, agent, keepCurrentPrompt) {
  const session = agent?.session
  if (!session) return { status: 'unavailable', reason: 'no session is attached to this call' }
  const eventAt = (seq) => session.eventAt(seq)
  const plan = planClear(session.surface.nodes, eventAt, { keepCurrentPrompt })
  if (plan.status !== 'ready') return plan
  // Measure and read before appending: afterwards the hidden nodes are no longer on the surface.
  const tokens = releasedTokens(ctx.tokenMeter, session, plan.shadowedSeqs)
  const prompts = clearedPrompts(eventAt, plan.shadowedSeqs)
  const marker = commitClear(session, plan, createUserMessage, tokens === undefined ? {} : { releasedTokens: tokens })
  return { ...plan, releasedTokens: tokens, prompts, markerSeq: marker?.seq }
}

function createClearTool(ctx) {
  return defineTool({
    name: 'clear_conversation',
    description: DESCRIPTION,
    parameters: {
      reason: {
        type: 'string',
        required: true,
        description: "Quote the words in the user's current message that asked for the clear."
      }
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }]
    },
    async execute(_args, exec) {
      const plan = clearAgent(ctx, exec.agent, true)
      const notice = updates.current()
      const tell = notice ? ` Also tell the user, in one line: ${notice}` : ''
      if (plan.status === 'ready') {
        const released = plan.releasedTokens === undefined ? '' : ` (released about ${plan.releasedTokens} input tokens)`
        return {
          status: 'cleared',
          clearedMessages: plan.clearedCount,
          ...(plan.releasedTokens === undefined ? {} : { releasedTokens: plan.releasedTokens }),
          instruction: `Context cleared${released}. Answer the rest of the current message without using anything said before it. Start your reply with one short line such as "Context cleared."${tell}`
        }
      }
      if (plan.status === 'nothing_to_clear') {
        return {
          status: 'nothing_to_clear',
          instruction: 'There was nothing before this message to clear. Tell the user in one short line, then continue.'
        }
      }
      return {
        status: 'unavailable',
        instruction: `The clear did not run (${plan.reason}). Tell the user in one line, then continue without clearing.`
      }
    }
  })
}

/** Nested so it starts only where a human-command surface exists (not in ACP or headless). */
function createClearCommand(hostCtx) {
  return {
    name: 'clear-conversation-command',
    inject: ['commands'],
    apply(ctx) {
      ctx.effect(function* () {
        yield ctx.commands.register({
          name: 'clear',
          description: 'Clear the conversation context (earlier messages stay visible but are no longer sent)',
          async handler(invocation) {
            if (invocation.rawInput.trim().length > 0) return { kind: 'error', text: 'Usage: /clear (no arguments)' }
            // runMaintenance waits for idle, so a turn is never cut mid-flight.
            const plan = await invocation.agent.runMaintenance(async () => clearAgent(hostCtx, invocation.agent, false))
            if (plan.status === 'nothing_to_clear') return { kind: 'success', text: 'Nothing to clear yet.' }
            if (plan.status !== 'ready') return { kind: 'error', text: `Could not clear: ${plan.reason}.` }
            return {
              kind: 'success',
              text: formatClearSummary({ ...plan, notice: updates.current() }),
              ...(plan.markerSeq === undefined ? {} : { sourceEventSeq: plan.markerSeq })
            }
          }
        })
      }, 'clear-conversation command')
    }
  }
}

export function apply(ctx) {
  ctx.tools.register(createClearTool(ctx))
  ctx.plugin(createClearCommand(ctx))
}
