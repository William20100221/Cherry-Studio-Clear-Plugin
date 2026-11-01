# Cherry Studio Clear Plugin

Reset a conversation by asking in plain words, for example:
"clear everything above, then explain merge sort".

This repo has three parts. Each works on its own.

## 1. The MCP server: real clear for stock Cherry Studio chats

[`mcp-server`](mcp-server) is a tiny tool you add in Cherry Studio's MCP settings. No fork needed, and it really saves tokens.
It works by writing the Ctrl+K divider into Cherry Studio's database, with a backup first. If a Cherry Studio update changes the database, it stops and asks you to update.

- Needs Node.js 22.13 or newer. `node server.mjs --check` verifies your setup and tells you when a newer version exists.
- Chats only. Agents keep their memory in Claude's own transcript, which nothing outside the app can reset; use the fork for agents.

See the [MCP server README](mcp-server/README.md) for install steps.

## 2. The standalone skill

[`skill/clear-conversation`](skill/clear-conversation) is an Agent Skill. It works in stock Cherry Studio agents, Claude Code, and other apps that load skills.

- Install it from the latest release ZIP, or from GitHub with the link to its `SKILL.md`.
- Without special app support, it does a **soft reset**: the model ignores the earlier conversation and tells you the app's own way to clear for real.

See the [skill README](skill/clear-conversation/README.md) for install steps and phrases.

## 3. The Cherry Studio fork (optional upgrade)

[William20100221/cherry-studio, branch `feature/clear-context-tool`](https://github.com/William20100221/cherry-studio/tree/feature/clear-context-tool) adds a built-in `clear_conversation` tool. With it, a clear is real: older messages stay on screen but are no longer sent to the model, which saves tokens.

| | Chat topic | Agent session |
|---|---|---|
| Needs the skill | No, the tool's description is enough | Yes, for the full rules |
| Where the divider goes | Directly above the message that asked | After the current turn |
| When the fresh start begins | The next turn | The next turn, once the session is idle |
| Undo | Click the divider, or the Undo toast | The Undo toast (10 s) |
| Ctrl+K / eraser | Divider now, or a queued clear while streaming | Same |
| Ctrl+L | Stops the reply, then divider or delete (setting), queue continues | Same |
| Delete mode | Always asks first, also when the model requests it | Same |

Settings → Context Management has two switches: the default clear action (divider or delete) and whether the assistant may clear at all.

In an Agent session, follow-ups already queued behind the clearing turn still run with the old context.

## License

MIT for this repo. The Cherry Studio fork stays under Cherry Studio's AGPL-3.0 license.
