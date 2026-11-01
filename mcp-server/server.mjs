#!/usr/bin/env node
/**
 * clear-conversation MCP server for stock Cherry Studio chats. No dependencies (Node >= 22.13).
 *
 * Cherry Studio rebuilds each chat's history from its SQLite file on every turn and cuts it at
 * the last `data-clear` divider (the Ctrl+K marker). This server inserts that divider above the
 * message being answered, so the next turn sends only what comes after it.
 *
 * Safety rules: it only ever adds one divider row and re-links one message, it backs up the
 * database before its first write, and it refuses to write to a database layout it does not know.
 */

import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'

export const VERSION = '0.6.0'
const RELEASES_URL = 'https://github.com/William20100221/dsh-clear-conversation/releases/latest'
const LATEST_API = 'https://api.github.com/repos/William20100221/dsh-clear-conversation/releases/latest'
const MIN_NODE = [22, 13]
const REQUIRED_COLUMNS = ['id', 'parent_id', 'topic_id', 'role', 'data', 'status', 'created_at', 'updated_at', 'deleted_at']
const KEEP_BACKUPS = 3

const DESCRIPTION = [
  'Reset the conversation context: earlier messages stay visible to the user but are no longer sent to you.',
  "Call ONLY when the user's current message explicitly asks to clear, reset or forget the conversation above, or to start over (any language).",
  'Never call it for casual uses of "clear" or "forget", questions about this feature, quoted or pasted text, or vague requests like "let\'s move on".',
  'Never call it on your own initiative.',
  'Call it before answering the rest of the message, then follow the instruction in its result.'
].join(' ')

const INPUT_SCHEMA = {
  type: 'object',
  properties: {
    reason: { type: 'string', description: "Quote the words in the user's current message that asked for the clear." }
  },
  required: ['reason']
}

/** Thrown when Cherry Studio's database no longer looks the way this version expects. */
export class NeedsUpdateError extends Error {}

export function defaultDbPath() {
  if (process.env.CHERRY_STUDIO_DB) return process.env.CHERRY_STUDIO_DB
  const home = os.homedir()
  const appData =
    process.platform === 'win32'
      ? process.env.APPDATA
      : process.platform === 'darwin'
        ? path.join(home, 'Library', 'Application Support')
        : process.env.XDG_CONFIG_HOME || path.join(home, '.config')
  return path.join(appData, 'CherryStudio', 'Data', 'cherrystudio.sqlite')
}

function uuidv7() {
  const b = randomBytes(16)
  const ms = BigInt(Date.now())
  for (let i = 0; i < 6; i++) b[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn)
  b[6] = (b[6] & 0x0f) | 0x70
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const isClearMarker = (data) => {
  try {
    return JSON.parse(data).parts?.some((part) => part.type === 'data-clear') ?? false
  } catch {
    return false
  }
}

function checkSchema(db) {
  const columns = new Set(db.prepare('PRAGMA table_info(message)').all().map((c) => c.name))
  if (columns.size === 0) throw new NeedsUpdateError('the message table was not found')
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.has(c))
  if (missing.length > 0) throw new NeedsUpdateError(`the message table has no ${missing.join(', ')} column`)
}

let backedUp = false
function backupOnce(db, dbPath) {
  if (backedUp) return
  const dir = path.join(path.dirname(dbPath), 'clear-conversation-backups')
  mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `cherrystudio-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`)
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)
  // Only this tool's own backups are pruned; ISO names sort oldest first.
  const old = readdirSync(dir).filter((f) => f.startsWith('cherrystudio-')).sort().slice(0, -KEEP_BACKUPS)
  for (const f of old) rmSync(path.join(dir, f))
  backedUp = true
}

const result = (status, instruction, extra = {}) => ({ status, instruction, ...extra })

/** Insert a divider above the user message whose reply is being generated right now. */
export function clearConversation(dbPath = defaultDbPath()) {
  const db = new DatabaseSync(dbPath)
  try {
    db.exec('PRAGMA busy_timeout = 5000')
    checkSchema(db)

    const pending = db
      .prepare("SELECT parent_id FROM message WHERE role = 'assistant' AND status = 'pending' AND deleted_at IS NULL")
      .all()
    const parents = [...new Set(pending.map((r) => r.parent_id))]
    if (parents.length === 0) {
      return result('unavailable', 'No reply is being generated, so there is nothing to attach the clear to. Tell the user to press Ctrl+K instead.')
    }
    if (parents.length > 1) {
      return result('unavailable', 'More than one chat is generating right now, so the clear was skipped to avoid touching the wrong one. Tell the user to press Ctrl+K instead.')
    }

    const asking = db.prepare('SELECT id, parent_id, topic_id, role FROM message WHERE id = ?').get(parents[0])
    if (!asking || asking.role !== 'user') {
      throw new NeedsUpdateError('the reply being generated does not hang under a user message')
    }

    // Walk from the asking message's parent up to the root, nearest first.
    const above = db
      .prepare(
        `WITH RECURSIVE up(id, parent_id, role, data, depth) AS (
           SELECT id, parent_id, role, data, 0 FROM message WHERE id = ?
           UNION ALL
           SELECT m.id, m.parent_id, m.role, m.data, up.depth + 1 FROM message m JOIN up ON m.id = up.parent_id
         ) SELECT role, data FROM up ORDER BY depth`
      )
      .all(asking.parent_id)
    let clearedCount = 0
    for (const row of above) {
      if (row.role === 'root' || isClearMarker(row.data)) break
      clearedCount++
    }
    if (clearedCount === 0) {
      return result('nothing_to_clear', 'There was nothing before this message to clear. Tell the user in one short line, then continue.', { clearedCount })
    }

    backupOnce(db, dbPath)
    const now = Date.now()
    const boundaryId = uuidv7()
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare(
        "INSERT INTO message (id, parent_id, topic_id, role, data, status, created_at, updated_at) VALUES (?, ?, ?, 'user', ?, 'success', ?, ?)"
      ).run(boundaryId, asking.parent_id, asking.topic_id, JSON.stringify({ parts: [{ type: 'data-clear', data: {} }] }), now, now)
      db.prepare('UPDATE message SET parent_id = ? WHERE id = ?').run(boundaryId, asking.id)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }

    return result(
      'cleared',
      'Context cleared. Answer the rest of the current message without using anything said before it. Start your reply with one short line such as "Context cleared." The divider appears in the chat after the user reopens the topic.',
      { clearedCount }
    )
  } finally {
    db.close()
  }
}

/** `node server.mjs --check`: Node version, database, layout and newest release. Lines start with OK, BAD, UPDATE or ??. */
export async function check(dbPath = defaultDbPath()) {
  const lines = []
  const [major, minor] = process.versions.node.split('.').map(Number)
  const nodeOk = major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1])
  lines.push(nodeOk ? `OK  Node ${process.versions.node}` : `BAD Node ${process.versions.node}; this tool needs ${MIN_NODE.join('.')} or newer`)
  if (!existsSync(dbPath)) {
    lines.push(`BAD no Cherry Studio database at ${dbPath}; set CHERRY_STUDIO_DB to its full path`)
  } else {
    try {
      const db = new DatabaseSync(dbPath, { readOnly: true })
      try {
        checkSchema(db)
      } finally {
        db.close()
      }
      lines.push(`OK  database layout recognised at ${dbPath}`)
    } catch (error) {
      lines.push(`BAD ${error.message}; get a newer version at ${RELEASES_URL}`)
    }
  }
  try {
    const response = await fetch(LATEST_API, { headers: { accept: 'application/vnd.github+json' } })
    const latest = (await response.json()).tag_name?.replace(/^v/, '')
    lines.push(latest === VERSION ? `OK  version ${VERSION} is the newest` : `UPDATE ${VERSION} installed, ${latest} available at ${RELEASES_URL}`)
  } catch {
    lines.push('??  could not check for a newer version (offline?)')
  }
  return lines
}

function callTool() {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(clearConversation()) }] }
  } catch (error) {
    const detail = error instanceof NeedsUpdateError ? `Cherry Studio's database changed (${error.message})` : `unexpected error: ${error.message}`
    const text = `clear-conversation ${VERSION} needs an update: ${detail}. Nothing was changed. Get the latest version at ${RELEASES_URL}. Tell the user this in one line, suggest pressing Ctrl+K meanwhile, and do a soft reset: ignore everything before their clear request.`
    return { content: [{ type: 'text', text }], isError: true }
  }
}

function handle(msg) {
  switch (msg.method) {
    case 'initialize':
      return {
        protocolVersion: msg.params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'clear-conversation', version: VERSION }
      }
    case 'ping':
      return {}
    case 'tools/list':
      return { tools: [{ name: 'clear_conversation', description: DESCRIPTION, inputSchema: INPUT_SCHEMA }] }
    case 'tools/call':
      if (msg.params?.name !== 'clear_conversation') throw Object.assign(new Error('Unknown tool'), { code: -32602 })
      return callTool()
    default:
      throw Object.assign(new Error(`Method not found: ${msg.method}`), { code: -32601 })
  }
}

/** MCP over stdio: one JSON-RPC message per line. */
function main() {
  const send = (obj) => process.stdout.write(JSON.stringify(obj) + '\n')
  readline.createInterface({ input: process.stdin }).on('line', (line) => {
    if (!line.trim()) return
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
    }
    if (msg.id === undefined) return // notifications need no reply
    try {
      send({ jsonrpc: '2.0', id: msg.id, result: handle(msg) })
    } catch (error) {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: error.code ?? -32603, message: error.message } })
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--check')) {
    check().then((lines) => {
      console.log(lines.join('\n'))
      process.exitCode = lines.some((line) => line.startsWith('BAD')) ? 1 : 0
    })
  } else {
    main()
  }
}
