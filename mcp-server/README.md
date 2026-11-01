# clear-conversation MCP server

A real clear for **stock Cherry Studio chats**, with no fork needed.
Say "clear everything above, then …" and the model calls this tool. Older messages stay on screen but are no longer sent, so they stop costing tokens.

## How it works

Cherry Studio rebuilds each chat's history from a database file on your computer every turn, and stops at the last "new context" divider (the one Ctrl+K makes).
This tool writes that same divider into the file, directly above the message you just sent.

It's a workaround: it edits Cherry Studio's database from outside the app. These rules keep it safe:

- **Backup first.** Before its first change, it copies your database into `clear-conversation-backups` next to it. The 3 newest copies are kept.
- **Smallest possible change.** It adds one divider and re-links one message. It never deletes or edits message text.
- **Refuses when unsure.** If no reply is being generated, or two chats are generating at once, it does nothing.
- **Stops on unknown versions.** If a Cherry Studio update changes the database layout, it changes nothing and tells you in the chat to update this tool.

## Requirements

- Node.js 22.13 or newer, because the tool uses Node's built-in SQLite module. Check with `node --version`, and install from [nodejs.org](https://nodejs.org) if needed.
- Cherry Studio **chats**. Do not add this server to agents: an agent's memory lives in Claude's own transcript, which nothing outside the app can reset, and the tool cannot tell which agent called it. For agents, use the Cherry Studio fork, or type `/clear` in the agent's session yourself.

## Install

1. Download `clear-conversation-mcp-server.zip` from the [latest release](https://github.com/William20100221/dsh-clear-conversation/releases/latest) and unzip it somewhere permanent, for example `C:\Tools\clear-conversation`.
2. Check your setup. In a terminal, run:

   ```bash
   node C:\Tools\clear-conversation\mcp-server\server.mjs --check
   ```

   It prints one line each for your Node version, the Cherry Studio database, whether the database layout is recognised, and whether a newer version of this tool exists. Fix any line that starts with `BAD` before going on.
3. In Cherry Studio, open **Settings → MCP Servers**, click add, and choose **Import from JSON**. Paste this, with your own path:

   ```json
   {
     "mcpServers": {
       "clear-conversation": {
         "command": "node",
         "args": ["C:\\Tools\\clear-conversation\\mcp-server\\server.mjs"]
       }
     }
   }
   ```

4. Open the server, find the `clear_conversation` tool, and turn on **Auto Approve**. Otherwise Cherry Studio asks before every clear.
5. Add the server to the assistant you chat with: **Library → your assistant → Tools → Add MCP server**.

## Use

Send "clear everything above, then explain merge sort". The model replies "Context cleared." and answers.
The divider should appear when the reply finishes; if not, reopen the chat. To undo, click the divider.

## When it says it needs an update

You'll see a message like "clear-conversation needs an update". Nothing was changed. Running `--check` shows the same thing before it bites.
Download `clear-conversation-mcp-server.zip` from the [latest release](https://github.com/William20100221/dsh-clear-conversation/releases/latest) and unzip it over the old folder. Use Ctrl+K until then.

If the database is in an unusual place, set the `CHERRY_STUDIO_DB` environment variable to its full path.

## Test

```bash
node --test mcp-server/server.test.mjs
```

The tests run on a throwaway copy of the Cherry Studio dev database, never your real one.
