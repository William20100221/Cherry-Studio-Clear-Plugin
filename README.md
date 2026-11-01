# Cherry Studio Clear Plugin

Reset a conversation by asking in plain words, for example:
"clear everything above, then explain merge sort".

This repo has two parts. Each works on its own.

## 1. The standalone skill

[`skill/clear-conversation`](skill/clear-conversation) is an Agent Skill. It works in stock Cherry Studio agents, Claude Code, and other apps that load skills.

- Install it from the latest release ZIP, or from GitHub with the link to its `SKILL.md`.
- Without special app support, it does a **soft reset**: the model ignores the earlier conversation and tells you the app's own way to clear for real.

See the [skill README](skill/clear-conversation/README.md) for install steps and phrases.

## 2. The Cherry Studio fork (optional upgrade)

[William20100221/cherry-studio, branch `feature/clear-context-tool`](https://github.com/William20100221/cherry-studio/tree/feature/clear-context-tool) adds a built-in `clear_conversation` tool. With it, a clear is real: older messages stay on screen but are no longer sent to the model, which saves tokens.

| | Chat topic | Agent session |
|---|---|---|
| Needs the skill | No, the tool's description is enough | Yes, for the full rules |
| Where the divider goes | Directly above the message that asked | After the current turn |
| When the fresh start begins | The next turn | The next turn, once the session is idle |
| Undo | Click the divider | Not yet |

In an Agent session, follow-ups already queued behind that turn still run with the old context.

### Not built yet

These parts of [the design](docs/clear-context-design.md) are not built:

- Delete mode with a confirmation dialog
- Ctrl+L while a reply is streaming
- Clear items in the follow-up queue
- A setting to turn the tool off

## License

MIT for this repo. The Cherry Studio fork stays under Cherry Studio's AGPL-3.0 license.
