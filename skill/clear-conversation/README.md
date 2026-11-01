# clear-conversation skill

A standalone Agent Skill that resets the conversation when you ask in plain words, for example:

> clear everything above, then explain merge sort

It works in any app that loads Agent Skills, such as Cherry Studio agents and Claude Code. No special build is needed.

## Two levels of clearing

| | Soft reset (any app) | Real clear (app has a `clear_conversation` tool) |
|---|---|---|
| What the model does | Ignores everything before your request | Calls the tool, which stops sending old messages |
| Saves tokens | No, old messages are still sent | Yes, from the next turn |
| What you see | "Context reset." plus a tip for a real clear | "Context cleared." and a divider in the chat |

A skill on its own cannot delete or hide messages, because only the app controls what it sends to the model. That is why the soft reset also tells you the app's own way to clear for real.

For a real clear in stock Cherry Studio chats, add the [clear-conversation MCP server](../../mcp-server/README.md).

The real clear needs the Cherry Studio build at
[William20100221/cherry-studio, branch `feature/clear-context-tool`](https://github.com/William20100221/cherry-studio/tree/feature/clear-context-tool).

## Install

### Cherry Studio agent

1. **Add the skill.** Pick one:
   - **From GitHub:** open **Library → Skills**, choose **Install from GitHub**, and paste
     `https://github.com/William20100221/Cherry-Studio-Clear-Plugin/blob/main/skill/clear-conversation/SKILL.md`
   - **From a ZIP:** download `clear-conversation.zip` from the repo's latest release, then open **Library → Skills → Local import** and pick it.
2. **Turn it on.** Open the agent's settings, go to **Skills → Manage Skills**, and enable **clear-conversation**.

Cherry Studio chats (not agents) do not load skills. In a chat, press Ctrl+K to clear, or use the fork, whose built-in tool works in chats without this skill.

### Claude Code

Copy the `clear-conversation` folder into `~/.claude/skills/` for every project, or into `.claude/skills/` inside one project.

## Use

Ask for a clear, then add your next request in the same message.

**Phrases that work:**
- "clear everything above", "clear the context", "clear the chat"
- "forget the previous chat", "start over", "reset the conversation"
- "/clear" on its own line
- Other languages too, such as 清空上下文 or 重新开始

**Phrases that will not clear:**
- "clear my schedule", "can you clear up what you meant"
- "forget it, let's move on"
- "how do I clear the context?" (it explains instead)
- "let's talk about something else" (it may ask you first)

## Limits

- During the turn that asked for the clear, the model can still see the old messages. It is told to ignore them.
- A soft reset depends on the model following instructions. For a guaranteed clean slate, use the app's real clear.
- Nothing is ever deleted.
