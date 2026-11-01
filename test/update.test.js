// Run: node --test test/update.test.js — no network: fetch is replaced with stubs.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fetchLatestVersion, isNewer, startUpdateCheck, updateNotice } from '../update.js'

const reply = (body, ok = true) => async () => ({ ok, json: async () => body })

test('compares versions numerically, not as text', () => {
  assert.equal(isNewer('0.10.0', '0.9.0'), true)
  assert.equal(isNewer('v0.6.0', '0.6.0'), false)
  assert.equal(isNewer('0.5.9', '0.6.0'), false)
  assert.equal(isNewer('garbage', '0.6.0'), false)
})

test('only an older copy gets a reminder, and it says how to update', () => {
  assert.equal(updateNotice('0.6.0', '0.6.0'), undefined)
  assert.equal(updateNotice(undefined, '0.6.0'), undefined)
  assert.match(updateNotice('0.7.0', '0.6.0'), /0\.7\.0 is available \(you have 0\.6\.0\).*add github:/)
})

test('a failed or slow lookup yields no version instead of an error', async () => {
  assert.equal(await fetchLatestVersion({ fetchImpl: reply({}, false) }), undefined)
  assert.equal(await fetchLatestVersion({ fetchImpl: async () => { throw new Error('offline') } }), undefined)
  assert.equal(await fetchLatestVersion({ fetchImpl: reply({ tag_name: 'v0.7.0' }) }), '0.7.0')
})

test('the opt-out variable skips the network call entirely', async () => {
  let called = false
  const check = startUpdateCheck('0.6.0', {
    env: { DSH_CLEAR_CONVERSATION_NO_UPDATE_CHECK: '1' },
    fetchImpl: async () => { called = true }
  })
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(called, false)
  assert.equal(check.current(), undefined)
})

test('the reminder becomes available once the answer arrives', async () => {
  const check = startUpdateCheck('0.6.0', { env: {}, fetchImpl: reply({ tag_name: 'v0.7.0' }) })
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.match(check.current(), /0\.7\.0 is available/)
})
