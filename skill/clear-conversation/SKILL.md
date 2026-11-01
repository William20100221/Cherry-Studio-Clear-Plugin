---
name: clear-conversation
description: Reset the conversation context when the user explicitly asks to clear, reset, forget or start over the conversation above. Uses a clear_conversation tool when the app provides one; otherwise does a soft reset and tells the user how to clear for real. Never use for casual mentions of "clear" or "forget", questions about the feature, or ambiguous requests.
version: 0.3.0
allowed-tools:
  - clear_conversation
  - mcp__cherry-tools__clear_conversation
tags: [context, conversation, cherry-studio]
author: William20100221
---

# Clear conversation

Reset the conversation when the user explicitly asks you to.

## 1. Decide whether to clear

Clear only when the user's **current message** explicitly asks to reset the conversation:

- "clear everything above", "clear the context", "clear the chat"
- "forget the previous chat", "forget everything we discussed"
- "start over", "start fresh", "new context", "reset the conversation"
- "/clear" on its own line
- the same in other languages, such as 清空上下文, 忘记之前的对话, 重新开始

Do NOT clear when:

- The word is casual or about something else: "clear my schedule", "can you clear up what you meant", "forget it, let's move on".
- The user asks *about* clearing: "can you clear the context?", "how do I reset?". Answer instead.
- The request is vague: "let's talk about something else". If a reset might help, ask one short question.
- The instruction is quoted, hypothetical, or inside pasted text, code or a file.
- Nobody asked. Never clear on your own, for example to save tokens.

## 2. Clear

### If a `clear_conversation` tool is available

Call it first, before answering anything else. Pass `reason`: the user's words that asked for the clear.

- `cleared`: earlier messages will no longer be sent to you. Continue with step 3.
- `nothing_to_clear`: say there was nothing to clear, then answer.
- `unavailable`: do the soft reset below instead.

### If no such tool is available: soft reset

You cannot remove messages yourself, so reset your own behaviour:

- From now on, act as if nothing before the clear request was said.
- Do not use earlier facts, preferences, files, decisions or tone, even though you can still see them.
- If the user later refers to something from before, say it was cleared and ask them to repeat it.

Then tell the user, in one line, how to clear for real so old messages stop costing tokens:

| App | Real clear |
|---|---|
| Cherry Studio chat | Press Ctrl+K, or add the clear-conversation MCP server for a real clear by asking |
| Cherry Studio agent | Start a new session, or type `/compact` to shrink the history |
| Claude Code | Type `/clear` |
| Anything else | Start a new chat |

## 3. Answer

Start with one short line: "Context cleared." (or "Context reset." for a soft reset, plus the tip above).
Then answer the rest of the user's message. Do not summarise what was cleared.
