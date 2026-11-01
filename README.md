# Cherry Studio Clear Plugin

Lets you reset a Cherry Studio conversation by asking in plain words, for example:
"clear everything above, then explain merge sort".

The model calls a built-in `clear_conversation` tool. It inserts the same context divider as Ctrl+K:
older messages stay visible but are no longer sent to the model. Nothing is deleted.

## Requirements

The tool lives in a Cherry Studio fork, branch `feature/clear-context-tool`.
Stock Cherry Studio does not have it.

## Install

- **Chat topics:** nothing to install. The tool is built in, and its description tells the model when to use it.
- **Agents:** zip the `skill/clear-conversation` folder, then use Settings → Skills → Import and enable the skill on the agent.

## How it behaves

| | Chat topic | Agent session |
|---|---|---|
| Where the divider goes | Directly above the message that asked | After the current turn |
| When the fresh start begins | The next turn | The next turn, once the session is idle |
| Undo | Click the divider | Not yet |

The model still sees the old messages during the turn that asked for the clear. The tool result tells it to ignore them.

In an Agent session, follow-ups already queued behind that turn still run with the old context.

## Not built yet

These parts of `docs/clear-context-design.md` are not built:

- Delete mode with a confirmation dialog
- Ctrl+L while a reply is streaming
- Clear items in the follow-up queue
- A setting to turn the tool off
