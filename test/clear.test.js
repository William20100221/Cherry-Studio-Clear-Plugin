// Run: node --test test/clear.test.js
// Exercises the pure planner and commit against a fake surface; no DeepSeek Harness code runs.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { commitClear, MARKER_SOURCE_KIND, planClear } from '../clear.js'

/** A minimal stand-in for dsh's Session: events by seq plus a surface that honours replace. */
function fakeSession(events) {
  const log = new Map(events.map((event, i) => [i, { seq: i, ...event }]))
  let nodes = [...log.keys()]
  return {
    get surface() {
      return { nodes }
    },
    eventAt: (seq) => log.get(seq),
    append(type, data, { surfaceOp, sourceEventSeqs }) {
      const seq = log.size
      log.set(seq, { seq, type, data })
      const startIdx = nodes.indexOf(surfaceOp.startSeq)
      const endIdx = nodes.indexOf(surfaceOp.endSeq)
      assert.ok(startIdx !== -1 && endIdx >= startIdx, 'replace range must be on the surface')
      assert.deepEqual([...sourceEventSeqs].sort(), nodes.slice(startIdx, endIdx + 1).sort(), 'must cite every hidden node')
      nodes = [...nodes.slice(0, startIdx), seq, ...nodes.slice(endIdx + 1)]
    }
  }
}

const system = { type: 'system/message', data: { message: { role: 'system' } } }
const prompt = (text) => ({ type: 'user/message', data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] } })
const reply = (toolCalls = 0) => ({
  type: 'assistant/message',
  data: { message: { content: [{ type: 'text', text: 'ok' }, ...Array(toolCalls).fill({ type: 'tool-call' })] } }
})
const result = { type: 'tool/result', data: { message: {} } }
const createUserMessage = (input) => ({ role: 'user', id: 'm', ...input })
const plan = (session, keepCurrentPrompt) =>
  planClear(session.surface.nodes, (seq) => session.eventAt(seq), { keepCurrentPrompt })
const kinds = (session) => session.surface.nodes.map((seq) => session.eventAt(seq).data?.source?.kind ?? session.eventAt(seq).type)

test('the model tool hides earlier turns but keeps the system prompt and the asking prompt', () => {
  // system, turn 1 (prompt, tool call, result, reply), turn 2 (prompt "clear then X", tool call in progress)
  const session = fakeSession([system, prompt('hi'), reply(1), result, reply(), prompt('clear, then X'), reply(1)])

  const p = plan(session, true)
  assert.equal(p.status, 'ready')
  assert.equal(p.clearedCount, 4)
  commitClear(session, p, createUserMessage)

  assert.deepEqual(kinds(session), ['system/message', MARKER_SOURCE_KIND, 'user', 'assistant/message'])
})

test('a second clear right away finds nothing new to hide', () => {
  const session = fakeSession([system, prompt('a'), reply(), prompt('clear')])
  commitClear(session, plan(session, true), createUserMessage)
  assert.equal(plan(session, true).status, 'nothing_to_clear')
})

test('the first message of a conversation has nothing to clear', () => {
  const session = fakeSession([system, prompt('clear everything')])
  assert.equal(plan(session, true).status, 'nothing_to_clear')
})

test('refuses to cut through a tool call that has no result yet', () => {
  const session = fakeSession([system, prompt('a'), reply(2), result, prompt('clear')])
  assert.equal(plan(session, true).status, 'unavailable')
})

test('/clear while idle hides everything after the system prompt', () => {
  const session = fakeSession([system, prompt('a'), reply(), prompt('b'), reply()])
  const p = plan(session, false)
  assert.equal(p.clearedCount, 4)
  commitClear(session, p, createUserMessage)
  assert.deepEqual(kinds(session), ['system/message', MARKER_SOURCE_KIND])
})
