# dsh-clear-conversation

Clear the conversation context in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) by asking in plain words, for example:
"clear everything above, then explain merge sort".

Older turns stay in the transcript, but they stop being sent to the model, so they stop costing tokens and stop leaking into new answers.

## Install

Needs DeepSeek Harness 0.2.1-rc.5 or a later 0.2.x.

```sh
dsh plugin --profile web add github:William20100221/Cherry-Studio-Clear-Plugin
```

Then restart `dsh web`. Use another profile name (`headless`, `sdk`, `acp`, or your own) to install it there instead.
Remove it with `dsh plugin --profile web remove dsh-clear-conversation`.

## Use

- **Ask in a message.** "Clear everything above, then …", "forget the previous chat", "start over", or the same in another language. The model calls the `clear_conversation` tool, replies "Context cleared.", and answers the rest of your message.
- **Type `/clear`.** Clears everything at once while the agent is idle. Available where dsh shows commands (Web and SDK, not ACP or headless).

The tool is told to ignore casual phrases such as "forget it, let's move on" or "how do I clear the context?".

## How it works

dsh builds every request from the session's "surface", an ordered list of messages. Its own `/compact` command replaces a stretch of old turns with an AI-written summary. This plugin uses the same mechanism, but replaces them with one short note saying the conversation was cleared.

- Your current message and everything after it stay, so "clear, then do X" still gets X done.
- The system prompt is never touched.
- The session log keeps every original event, and the transcript still shows them.
- The model stops seeing the old turns from its very next request, even later in the same turn.
- A clear that would cut through an unfinished tool call is refused, so requests never break.

## Limits

- No undo. The old turns remain readable in the transcript but cannot be put back into the model's context.
- `/clear` needs an idle agent; it waits for the current turn to finish.

## Other harnesses

This repo also keeps the earlier Cherry Studio work. Each part works on its own.

### Cherry Studio chats: MCP server

[`mcp-server`](mcp-server) is a tiny tool you add in Cherry Studio's MCP settings. No fork needed, and it really saves tokens.
It works by writing the Ctrl+K divider into Cherry Studio's database, with a backup first. If a Cherry Studio update changes the database, it stops and asks you to update.

- Needs Node.js 22.13 or newer. `node server.mjs --check` verifies your setup and tells you when a newer version exists.
- Chats only. Agents keep their memory in Claude's own transcript, which nothing outside the app can reset; use the fork for agents.

See the [MCP server README](mcp-server/README.md) for install steps.

### Any skill-loading app: the skill

[`skill/clear-conversation`](skill/clear-conversation) is an Agent Skill. It works in stock Cherry Studio agents, Claude Code, and other apps that load skills.

- Install it from the latest release ZIP, or from GitHub with the link to its `SKILL.md`.
- Without special app support, it does a **soft reset**: the model ignores the earlier conversation and tells you the app's own way to clear for real.

See the [skill README](skill/clear-conversation/README.md) for install steps and phrases.

### Cherry Studio fork

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

## Development

```sh
npm test
```

The tests exercise the clearing logic against a stand-in session; they do not start dsh.

## License

MIT for this repo. The Cherry Studio fork stays under Cherry Studio's AGPL-3.0 license.
