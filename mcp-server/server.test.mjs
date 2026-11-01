// Run: node --test mcp-server/
// Uses a throwaway copy of a real Cherry Studio database (the dev one by default), never the original.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { clearConversation, NeedsUpdateError } from './server.mjs'

const SOURCE_DB =
  process.env.CLEAR_TEST_SOURCE_DB ?? path.join(process.env.APPDATA ?? '', 'CherryStudioDev', 'Data', 'cherrystudio.sqlite')
const skip = !existsSync(SOURCE_DB) && `no Cherry Studio database at ${SOURCE_DB}`

/** Copy the real database and seed u1 → a1 → u2 → a2, with a2 still generating. */
function seededCopy() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'clear-conv-'))
  const file = path.join(dir, 'cherrystudio.sqlite')
  const src = new DatabaseSync(SOURCE_DB, { readOnly: true })
  src.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)
  src.close()

  const db = new DatabaseSync(file)
  db.exec("UPDATE message SET status = 'success' WHERE status = 'pending'")
  const { id: rootId, topic_id: topicId } = db.prepare('SELECT id, topic_id FROM message WHERE parent_id IS NULL LIMIT 1').get()
  const insert = db.prepare(
    'INSERT INTO message (id, parent_id, topic_id, role, data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const rows = [
    ['u1', rootId, 'user', 'success'],
    ['a1', 'u1', 'assistant', 'success'],
    ['u2', 'a1', 'user', 'success'],
    ['a2', 'u2', 'assistant', 'pending']
  ]
  rows.forEach(([id, parent, role, status], i) =>
    insert.run(id, parent, topicId, role, JSON.stringify({ parts: [{ type: 'text', text: id }] }), status, i, i)
  )
  db.close()
  return { dir, file }
}

const rowOf = (file, id) => {
  const db = new DatabaseSync(file, { readOnly: true })
  try {
    return db.prepare('SELECT parent_id, data FROM message WHERE id = ?').get(id)
  } finally {
    db.close()
  }
}

test('inserts a divider above the asking message, once, after backing up', { skip }, () => {
  const { dir, file } = seededCopy()

  const first = clearConversation(file)
  assert.equal(first.status, 'cleared')
  assert.equal(first.clearedCount, 2)

  const divider = rowOf(file, rowOf(file, 'u2').parent_id)
  assert.match(divider.data, /data-clear/)
  assert.equal(divider.parent_id, 'a1', 'divider must sit between a1 and u2')
  assert.equal(readdirSync(path.join(dir, 'clear-conversation-backups')).length, 1)

  assert.equal(clearConversation(file).status, 'nothing_to_clear')
})

test('refuses when no reply is being generated', { skip }, () => {
  const { file } = seededCopy()
  const db = new DatabaseSync(file)
  db.exec("UPDATE message SET status = 'success' WHERE id = 'a2'")
  db.close()

  assert.equal(clearConversation(file).status, 'unavailable')
  assert.equal(rowOf(file, 'u2').parent_id, 'a1', 'nothing may change')
})

test('stops with an update error on an unknown database layout', () => {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'clear-conv-')), 'old.sqlite')
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE message (id TEXT, parent_id TEXT)')
  db.close()

  assert.throws(() => clearConversation(file), NeedsUpdateError)
})

test('answers MCP requests over stdio and reports update errors to the model', async () => {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'clear-conv-')), 'old.sqlite')
  new DatabaseSync(file).close()
  const server = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))], {
    env: { ...process.env, CHERRY_STUDIO_DB: file }
  })
  const replies = []
  server.stdout.on('data', (chunk) => replies.push(...chunk.toString().trim().split('\n').map((l) => JSON.parse(l))))
  for (const msg of [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'clear_conversation', arguments: { reason: 'clear' } } }
  ])
    server.stdin.write(JSON.stringify(msg) + '\n')
  await new Promise((resolve) => setTimeout(resolve, 1500))
  server.kill()

  assert.equal(replies.length, 3, 'the notification must not get a reply')
  assert.equal(replies[1].result.tools[0].name, 'clear_conversation')
  assert.equal(replies[2].result.isError, true)
  assert.match(replies[2].result.content[0].text, /needs an update.*releases\/latest/)
})
