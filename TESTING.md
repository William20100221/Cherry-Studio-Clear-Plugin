# Testing dsh-clear-conversation yourself

About 15 minutes. Uses DeepSeek's API, which costs a few cents for these tests.
Commands are for PowerShell on Windows; they work the same in a macOS or Linux terminal.

**Have the desktop app?** Skip steps 1 to 5. Open **Plugins → Add plugin**, keep the registry on **Official npm registry**, enter `github:William20100221/dsh-clear-conversation`, install, and restart the app if it asks. Then go to step 6.
To pick up a newer version later, remove the plugin on the Plugins page and add it again.

## 1. Install the tools

You need Node.js (check with `node --version`). Then install pnpm, which `dsh plugin` uses, and DeepSeek Harness:

```sh
npm install -g pnpm @deepseek-ai/dsh
```

Check both:

```sh
pnpm --version
dsh --version
```

## 2. Give dsh your DeepSeek API key

Create a key at [platform.deepseek.com](https://platform.deepseek.com) → API keys. In the terminal you will start dsh from, run (with your own key):

```sh
$env:DEEPSEEK_API_KEY = "sk-your-key-here"
```

This lasts only for that terminal window. Never paste the key into a chat, an issue, or a file you share.

## 3. Install the plugin

```sh
dsh plugin --profile web add github:William20100221/dsh-clear-conversation
```

To test a local copy instead, pass its folder path in place of `github:...`.

## 4. Optional: stop dsh uploading session logs

By default dsh sends the session log to DeepSeek with each request. To turn that off, open
`~/.dsh/profiles/web/cordis.patch.yml` (on Windows: `C:\Users\<you>\.dsh\profiles\web\cordis.patch.yml`) and add:

```yaml
- id: session-log-deepseek
  config:
    enabled: false
```

## 5. Start dsh

```sh
dsh web
```

Your browser opens at `http://127.0.0.1:3080`. Start a new session.

## 6. Run the checks

Send each message in order and compare with the expected result.

| # | Send | Expected |
|---|---|---|
| 1 | `Do you have a tool called clear_conversation? Answer yes or no.` | Yes. If no, stop: the plugin did not load (see below). |
| 2 | `My favourite colour is green. Reply with just OK.` | OK |
| 3 | `Clear everything above, then tell me a short joke.` | A `clear_conversation` tool card, "Context cleared.", then a joke |
| 4 | `What is my favourite colour?` | It does not know |
| 5 | `Forget it, let's move on. What is 2 + 2?` | 4, with no tool card |
| 6 | `My favourite fruit is mango.` then type `/clear` | A "Context cleared" card with a larger title and "released ~N input tokens · M messages" beside it |
| 6b | Click that card | It opens and lists the cleared prompts, including "My favourite fruit is mango." |
| 7 | `What is my favourite fruit?` | It does not know |

Check 1 confirms the plugin loaded, checks 3 and 4 confirm a real clear, check 5 confirms casual phrases are ignored, and checks 6, 6b and 7 confirm `/clear` and its card. If check 6 shows plain text instead of a card, the clear still worked; the card just did not load, so please report it.

## If something goes wrong

- **dsh will not start:** the error ends with a `Full diagnostics:` path under `~/.dsh/logs/`. Open that file.
- **Check 1 says no:** run `dsh --profile web --dump-config` and look for a `# == dsh-clear-conversation` layer.
- **`pnpm` not found:** reopen the terminal after step 1, or run `npm install -g pnpm` again.

Please report problems in an [issue](https://github.com/William20100221/dsh-clear-conversation/issues). Include which check failed and the error text, but never your API key.

## Clean up

```sh
dsh plugin --profile web remove dsh-clear-conversation
```

Restart dsh afterwards.
