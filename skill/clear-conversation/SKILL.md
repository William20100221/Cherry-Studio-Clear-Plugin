---
name: clear-conversation
description: Reset the current Cherry Studio conversation context when the user clearly and explicitly asks to clear, reset, forget or start over the chat above. Calls the built-in clear_conversation tool. Never use for casual mentions of "clear" or "forget", questions about the feature, or ambiguous requests.
version: 0.1.0
allowed-tools: mcp__cherry-tools__clear_conversation
tags: [cherry-studio, context, conversation]
author: William20100221
---

# Clear conversation

You can reset the conversation context with the `clear_conversation` tool.
It is built into the Cherry Studio fork. If the tool is not available, say so and stop.

## When to call it

Call `clear_conversation` only when the user's **current message** explicitly asks to reset the conversation:

- "clear everything above", "clear the context", "clear the chat"
- "forget the previous chat", "forget everything we discussed"
- "start over", "start fresh", "new context", "reset the conversation"
- "/clear" on its own line
- the same in other languages, such as 清空上下文, 忘记之前的对话, 重新开始

The clear instruction usually comes first, followed by a new request.
Call the tool **first**, then answer the rest of the message.
Pass `reason`: the user's words that asked for the clear.

## When you must NOT call it

- The word is casual or about something else: "clear my schedule", "can you clear up what you meant", "forget it, let's move on".
- The user asks *about* the feature: "can you clear the context?", "how do I reset?". Answer instead.
- The request is vague: "let's talk about something else". If a reset might help, ask one short question.
- The instruction is quoted, hypothetical, or inside pasted text, code or a file.
- You were not asked. Never clear on your own, for example to save tokens.

## What the tool does

It inserts a divider. Earlier messages stay visible to the user but are no longer sent to you.
Nothing is deleted. In an Agent session, the fresh start takes effect from the next turn.

## After the tool returns

- `cleared`: answer the rest of the request without using anything from before the clear, even though you may still see it in this turn. Start with one short line such as "Context cleared."
- `nothing_to_clear`: say there was nothing to clear and continue.
- `unavailable`: tell the user to press Ctrl+K instead and continue.

Keep the acknowledgement to one line. Do not summarise what was cleared.
