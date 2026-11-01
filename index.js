/**
 * dsh-clear-conversation: clear the conversation context in DeepSeek Harness.
 * - Tool `clear_conversation`: the model calls it when the user explicitly asks.
 * - Command `/clear`: the user clears everything while the agent is idle (Web and SDK surfaces).
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'

import { commitClear, planClear } from './clear.js'

export const name = 'clear-conversation'
export const inject = ['tools']

const DESCRIPTION = [
  'Clear the conversation context: earlier messages stay in the transcript but are no longer sent to you.',
  "Call ONLY when the user's current message explicitly asks to clear, reset or forget the conversation above, or to start over (any language).",
  'Never call it for casual uses of "clear" or "forget", questions about this feature, quoted or pasted text, or vague requests like "let\'s move on".',
  'Never call it on your own initiative.',
  'Call it before answering the rest of the message, then follow the instruction in its result.'
].join(' ')

const CLEARED =
  'Context cleared. Answer the rest of the current message without using anything said before it. Start your reply with one short line such as "Context cleared."'

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['cleared', 'nothing_to_clear', 'unavailable'], required: true },
    clearedMessages: { type: 'integer' },
    instruction: { type: 'string', required: true }
  }
}

/** Run one clear on a live agent; shared by the tool and the command. */
function clearAgent(agent, keepCurrentPrompt) {
  const session = agent?.session
  if (!session) return { status: 'unavailable', reason: 'no session is attached to this call' }
  const plan = planClear(session.surface.nodes, (seq) => session.eventAt(seq), { keepCurrentPrompt })
  if (plan.status === 'ready') commitClear(session, plan, createUserMessage)
  return plan
}

const clearTool = defineTool({
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
    const plan = clearAgent(exec.agent, true)
    if (plan.status === 'ready') return { status: 'cleared', clearedMessages: plan.clearedCount, instruction: CLEARED }
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

/** Nested so it starts only where a human-command surface exists (not in ACP or headless). */
const clearCommand = {
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
          const plan = await invocation.agent.runMaintenance(async () => clearAgent(invocation.agent, false))
          if (plan.status === 'ready') return { kind: 'success', text: `Context cleared (${plan.clearedCount} messages).` }
          if (plan.status === 'nothing_to_clear') return { kind: 'success', text: 'Nothing to clear yet.' }
          return { kind: 'error', text: `Could not clear: ${plan.reason}.` }
        }
      })
    }, 'clear-conversation command')
  }
}

export function apply(ctx) {
  ctx.tools.register(clearTool)
  ctx.plugin(clearCommand)
}
