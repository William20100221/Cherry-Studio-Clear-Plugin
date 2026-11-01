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
 * @param {{ releasedTokens?: number }} [stats] - figures recorded on the marker for display.
 * @returns the appended marker event.
 */
export function commitClear(session, plan, createUserMessage, stats = {}) {
  const marker = createUserMessage({
    content: [{ type: 'text', text: MARKER_TEXT }],
    // `source` is metadata, never sent to the model.
    source: { kind: MARKER_SOURCE_KIND, clearedCount: plan.clearedCount, ...stats }
  })
  return session.append('user/message', marker, {
    surfaceOp: { op: 'replace', startSeq: plan.startSeq, endSeq: plan.endSeq },
    sourceEventSeqs: [...plan.shadowedSeqs]
  })
}

/**
 * Input tokens the hidden nodes cost per request, from dsh's own token meter. Measure BEFORE the
 * marker is appended. Returns undefined when no meter is available or it fails.
 * @param {{ measure: Function } | undefined} meter - the `tokenMeter` service.
 */
export function releasedTokens(meter, session, shadowedSeqs) {
  try {
    const hidden = new Set(shadowedSeqs)
    return meter.measure(session).nodes
      .filter((node) => hidden.has(node.seq))
      .reduce((sum, node) => sum + (node.tokens ?? node.heuristicTokens ?? 0), 0)
  } catch {
    return undefined
  }
}

/** First line of each human prompt among the hidden nodes, for the cleared-content list. */
export function clearedPrompts(eventAt, shadowedSeqs, { max = 10, width = 80 } = {}) {
  const prompts = shadowedSeqs
    .map((seq) => eventAt(seq))
    .filter(isHumanPrompt)
    .map((event) => (event.data.content ?? []).find((block) => block.type === 'text')?.text ?? '')
    .map((text) => text.trim().split('\n')[0])
    .filter(Boolean)
    .map((line) => (line.length > width ? `${line.slice(0, width - 1)}…` : line))
  return prompts.length > max ? [...prompts.slice(0, max), `…and ${prompts.length - max} more`] : prompts
}

/**
 * The `/clear` result text. Line 1 is the summary; after a blank line come the cleared prompts.
 * The client card relies on this layout; without the card it still reads as plain text.
 */
export function formatClearSummary({ clearedCount, releasedTokens: tokens, prompts = [], notice }) {
  const released = tokens === undefined ? '' : ` · released ~${tokens.toLocaleString('en-US')} input tokens`
  const lines = [`Context cleared${released} · ${clearedCount} ${clearedCount === 1 ? 'message' : 'messages'}`]
  if (prompts.length > 0) lines.push('', 'Cleared:', ...prompts.map((prompt) => `• ${prompt}`))
  if (notice) lines.push('', notice)
  return lines.join('\n')
}
