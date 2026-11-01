/**
 * Clear-context planning for DeepSeek Harness. Pure: it reads the session surface through
 * `eventAt` and imports nothing from dsh, so it can be tested without running the harness.
 *
 * dsh builds every model request from the session "surface" (an ordered list of event seqs).
 * Built-in compaction hides old turns by appending one `user/message` that replaces a surface
 * range; this plugin does the same with a short marker instead of an LLM summary. The hidden
 * events stay in the session log and in the UI transcript.
 */

export const MARKER_SOURCE_KIND = 'clear-conversation'
export const MARKER_TEXT =
  '[The earlier conversation was cleared at the user\'s request. It is no longer available; do not refer to it.]'

const isHumanPrompt = (event) => event?.type === 'user/message' && event.data?.source?.kind === 'user'
const isMarker = (event) => event?.type === 'user/message' && event.data?.source?.kind === MARKER_SOURCE_KIND

/** +n for an assistant message with n tool calls, -1 for a tool result. */
function toolCallDelta(event) {
  if (event?.type === 'assistant/message') {
    return (event.data.message?.content ?? []).filter((block) => block.type === 'tool-call').length
  }
  return event?.type === 'tool/result' ? -1 : 0
}

/**
 * Decide which surface nodes a clear hides.
 * @param {readonly number[]} nodes - current surface seqs, oldest first.
 * @param {(seq: number) => {type: string, data: any} | undefined} eventAt - session event lookup.
 * @param {{ keepCurrentPrompt: boolean }} options - true for the model tool (keep the asking
 *   prompt and everything after it), false for the idle `/clear` command (hide everything).
 * @returns {{status: 'ready', startSeq: number, endSeq: number, shadowedSeqs: number[], clearedCount: number}
 *   | {status: 'nothing_to_clear' | 'unavailable', reason: string}}
 */
export function planClear(nodes, eventAt, { keepCurrentPrompt }) {
  // Surface node 0 holds the system prompt; only a system/message may replace it.
  const first = eventAt(nodes[0])?.type === 'system/message' ? 1 : 0
  let last = nodes.length - 1
  if (keepCurrentPrompt) {
    const promptIdx = nodes.findLastIndex((seq) => isHumanPrompt(eventAt(seq)))
    if (promptIdx === -1) return { status: 'unavailable', reason: 'no user prompt found on the surface' }
    last = promptIdx - 1
  }

  const range = nodes.slice(first, last + 1)
  const clearedCount = range.filter((seq) => !isMarker(eventAt(seq))).length
  if (clearedCount === 0) return { status: 'nothing_to_clear', reason: 'nothing before this point to clear' }

  // A cut inside an unanswered tool call would orphan its result and break the request.
  let open = 0
  for (const seq of nodes.slice(0, last + 1)) open += toolCallDelta(eventAt(seq))
  if (open !== 0) return { status: 'unavailable', reason: 'a tool call before the cut has not finished' }

  return { status: 'ready', startSeq: range[0], endSeq: range.at(-1), shadowedSeqs: range, clearedCount }
}

/**
 * Append the marker that replaces the planned range on the surface.
 * @param {{ append: Function }} session - the dsh Session.
 * @param {{ startSeq: number, endSeq: number, shadowedSeqs: number[] }} plan - a ready plan.
 * @param {(input: object) => object} createUserMessage - dsh-llm's message factory.
 */
export function commitClear(session, plan, createUserMessage) {
  const marker = createUserMessage({
    content: [{ type: 'text', text: MARKER_TEXT }],
    source: { kind: MARKER_SOURCE_KIND }
  })
  session.append('user/message', marker, {
    surfaceOp: { op: 'replace', startSeq: plan.startSeq, endSeq: plan.endSeq },
    sourceEventSeqs: [...plan.shadowedSeqs]
  })
}
