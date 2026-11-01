// Run: node --test test/client.test.js
// Loads lib/client.js the way the dsh shell does (a plain script calling window.__ModuleLoader__),
// with stand-ins for the shared modules, then checks registration and what the card renders.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

import { formatClearSummary } from '../clear.js'

/** Run the bundle and return its factory's exports, built with stub shared modules. */
function loadClient({ openState = false } = {}) {
  let factory
  const window = { __ModuleLoader__: { load: (entry) => { factory = entry } } }
  vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), { window, document: undefined })
  assert.equal(factory.id, 'dsh-clear-conversation', 'id must equal the package name')
  const element = (type, props) => ({ type, props })
  const shared = {
    react: { useState: (initial) => [openState || initial, () => {}] },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    '@deepseek-ai/dsh-client-ui-primitives': { DisclosureRow: 'DisclosureRow' }
  }
  return factory.id && factory.factory((name) => {
    if (!(name in shared)) throw new Error(`unexpected require: ${name}`)
    return shared[name]
  })
}

const t = (key) => `t:${key}`
const row = (card) => card.props.children.props
const texts = (node) =>
  node == null || typeof node !== 'object' ? [node].filter((v) => typeof v === 'string')
    : [node.props?.children].flat().flatMap(texts)

test('registers a card for the /clear command only', () => {
  const client = loadClient()
  const calls = []
  client.apply({
    effect: (fn) => fn(),
    locale: { register: (ns, dict) => calls.push(['locale', ns, Object.keys(dict)]) },
    slots: {
      inject: (name, fn) => { calls.push(['inject', name]); fn() },
      register: (options, component) => calls.push(['register', options, component.name])
    }
  })
  // The bundle runs in its own VM realm, so compare plain JSON rather than object identity.
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['locale', 'dsh-clear-conversation', ['en', 'zh']],
    ['inject', 'conversation.chat.commandview'],
    ['register', { name: 'conversation.chat.commandview', key: 'clear', locale: 'dsh-clear-conversation' }, 'ClearCard']
  ])
})

test('a successful clear shows a large title, the released tokens, and hides the list until opened', () => {
  const text = formatClearSummary({ clearedCount: 4, releasedTokens: 1500, prompts: ['hi', 'cat names'], notice: 'update!' })
  const closed = row(loadClient().ClearCard({ node: { outcome: { kind: 'success', text } }, t }))
  assert.equal(closed.title, 't:cleared')
  assert.equal(closed.titleClassName, 'dshcc-title')
  assert.deepEqual(texts(closed.collapsedContent), ['released ~1,500 input tokens · 4 messages'])
  assert.equal(closed.expandable, true)
  assert.equal(closed.children, undefined, 'cleared content is hidden while collapsed')

  const opened = row(loadClient({ openState: true }).ClearCard({ node: { outcome: { kind: 'success', text } }, t }))
  assert.deepEqual(texts(opened.children), ['t:heading', '• hi', '• cat names', 'update!'])
})

test('running and failed states use their own titles and cannot expand', () => {
  const client = loadClient()
  assert.equal(row(client.ClearCard({ node: { outcome: null }, t })).running, true)
  const failed = row(client.ClearCard({ node: { outcome: { kind: 'error', text: 'Could not clear: busy.' } }, t }))
  assert.equal(failed.title, 't:failed')
  assert.equal(failed.expandable, false)
})
