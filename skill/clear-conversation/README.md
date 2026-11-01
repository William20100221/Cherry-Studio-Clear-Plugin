# clear-conversation skill

Reset a Cherry Studio conversation by asking in plain words.
Older messages stay on screen but are no longer sent to the model, which saves tokens and stops old topics from leaking into new answers.

## Before you start

You need the Cherry Studio build that includes the `clear_conversation` tool.
Stock Cherry Studio does not have it.

- Source: [William20100221/cherry-studio, branch `feature/clear-context-tool`](https://github.com/William20100221/cherry-studio/tree/feature/clear-context-tool)
- Run it from source with `pnpm install` and then `pnpm dev`.

## Use it in a Chat topic

Nothing to install. The tool is built in, and its description tells the model when to use it.

1. Open any chat.
2. Send a message that asks for a clear, then your next request:

   > clear everything above, then explain merge sort

3. A dashed **new context** divider appears above your message. The model answers starting with "Context cleared."
4. To undo, click the divider. The earlier messages are sent to the model again.

## Use it in an Agent

Agents load skills, so install this one to give the agent the full rules.

1. **Install the skill.** Pick one:
   - **From GitHub:** open **Library → Skills**, choose **Install from GitHub**, and paste
     `https://github.com/William20100221/Cherry-Studio-Clear-Plugin/blob/main/skill/clear-conversation/SKILL.md`
   - **From a ZIP:** in PowerShell, from the repo folder, run
     `Compress-Archive -Path skill\clear-conversation -DestinationPath clear-conversation.zip`,
     then open **Library → Skills → Local import** and pick the ZIP.
2. **Enable it on your agent.** Open the agent's settings, go to **Skills → Manage Skills**, and turn on **clear-conversation**.
3. **Ask for a clear** the same way as in a chat. The divider appears after the agent's reply. The agent starts with a fresh memory from your next message.

## Phrases that work

- "clear everything above", "clear the context", "clear the chat"
- "forget the previous chat", "start over", "reset the conversation"
- "/clear" on its own line
- Other languages too, such as 清空上下文 or 重新开始

## Phrases that will not clear

The model is told to ignore casual or unclear wording:

- "clear my schedule", "can you clear up what you meant"
- "forget it, let's move on"
- "how do I clear the context?" (it explains instead)
- "let's talk about something else" (it may ask you first)

## Limits

- During the turn that asked for the clear, the model can still see the old messages. It is told to ignore them. The next turn is truly clean.
- In an Agent session, messages already waiting in the queue still see the old context.
- Agent dividers cannot be undone yet.
- Nothing is deleted. Delete mode is not built yet.
