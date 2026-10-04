# claude-code-mods

Personal Claude Code mods: plugins of function hooks that restyle the transcript, add rows around
the prompt and react to tool calls. Built and used on Claude Code 2.1.287+, Linux.

## Mods

| Mod | What it does | Commands | Needs |
|---|---|---|---|
| [quiet-bash](quiet-bash/) | One-line tool rows (`✓ <description>`, red `✗ exit N` on failure, `+N −M` on edits, duration for calls ≥10 s). Hides every tool's result block (Bash output, Edit diffs, WebFetch, MCP and Agent results; interactive tools, SendUserFile and image Reads keep theirs), finished read-only rows (Read/Grep/Glob, and calls the engine ran read-only like `ls` or `git status`), collapsed tool groups unless one failed, and timed-out GitLab pipeline-wait notices. Inline PNG thumbnails under rows that read, sent or wrote a PNG, relative paths included | `/quiet` brings it all back; `/thumb [big] <path>` shows a PNG | ImageMagick (`magick`) for thumbnails; a terminal with kitty graphics (see [herdr](#herdr-images-and-links)) |
| [quiet-spinner](quiet-spinner/) | Plain spinner words (`thinking`, `writing`, `running`) and `Took 1m 4s` instead of the whimsical ones | – | – |
| [usage-percent](usage-percent/) | Row under the prompt: `ctx 34% \| 5h 41% \| wk 86%▲`. In Nx repos also memory (`claude.slice` + `app.slice` pressure), running `nx serve` projects and the branch's pipeline (`⏸` when it waits on a manual job) | – | `gh` / `glab` logged in for the pipeline; systemd `claude.slice` for memory |
| [reminder-log](reminder-log/) | Tallies the reminders Claude Code injects for the model, per session; drops the token counter and repeated commit attribution blocks | `/reminders` prints the tally of the last 30 days | – |
| [mr-banner](mr-banner/) | Colored card with a link under each MR/PR created, merged, approved or reviewed | – | GitLab MCP server named `gitlab`, or `glab` / `gh` |
| [coderabbit-band](coderabbit-band/) | Band above the prompt with the open CodeRabbit threads (by severity) and nitpicks of the current branch's GitLab MR, with a link. Shows only when something is open | `/coderabbit` hides it until the counts change | `glab` logged in; GitLab remote |
| [redact](redact/) | Secrets in prompts and tool output reach the model as `‹secret:…›` tokens; only Write/Edit turn them back into the real value. See [redact](#redact-secrets-as-tokens) | – | `betterleaks` on `PATH` |
| [mem-guard](mem-guard/) | Bash commands that run Node tools go into a memory-capped `claude-cmd.slice` scope. Refused, with the fix in the message: `nx affected`/`run-many` without `--parallel=1`, a pnpm script that has a `:lite` twin, jest without a worker cap, `pkill -f`/`pgrep -f` with an unbracketed pattern, `ci:local`, and heavy runs while the slice is above 75 % or under pressure. See [mem-guard](#mem-guard-memory-rules-for-bash) | – | a systemd user `claude-cmd.slice`, see [mem-guard](#mem-guard-memory-rules-for-bash) |

The model sees exactly what it would without them: the mods change what is drawn, except
reminder-log, which drops two kinds of injected reminders, redact, which hides secrets, and mem-guard,
which runs Node commands inside a systemd scope and refuses some with a `mem-guard: …` error.

Two mods call out on their own:

- **mr-banner**, when a GitLab MCP note or approval answers without the MR's link, calls
  `get_merge_request` on the `gitlab` MCP server for the link and title. `gh`/`glab` commands
  cost nothing extra.
- **coderabbit-band** polls `glab` for GitLab `origin` remotes: a 60 s timer checks the branch,
  and a fetch (`glab mr view` plus all pages of the MR's discussions) runs every minute for
  15 min after a `git push`, every 5 min while the band shows something, every 15 min otherwise,
  and once 5 s after a thread is resolved.

## Install

Claude Code loads every plugin folder under `~/.claude/skills/` at session start.

- **Empty `~/.claude/skills`:** clone straight into it:
  ```sh
  git clone https://github.com/schreibse/claude-code-mods ~/.claude/skills
  ```
- **Existing skills there:** clone elsewhere and link the mods you want:
  ```sh
  git clone https://github.com/schreibse/claude-code-mods ~/src/claude-code-mods
  ln -s ~/src/claude-code-mods/quiet-bash ~/.claude/skills/quiet-bash   # per mod
  ```

New sessions pick them up; a running one needs `/exit` and `claude --continue`.

**Leave a mod out:** delete or unlink its folder. **Try one for a single session:**
`claude --plugin-dir ~/src/claude-code-mods/<mod>`.

**This repo is the skills folder itself**, so `.gitignore` ignores everything and re-includes each
mod: a new mod needs a `!/<name>/` line or git won't see it. `.claude-plugin/types/` is generated
by the engine and stays untracked.

## redact: secrets as tokens

betterleaks scans every prompt and tool result before it reaches the model. Each value it flags
becomes `‹secret:xxxxxxxx›` and stays hidden wherever it appears later, even where the scanner
would not recognise it again.

| The model's call | What happens |
|---|---|
| Write, Edit, NotebookEdit with a token | the real value is written to the file |
| Write that would drop a secret the file holds | refused: use Edit |
| Agent, SendMessage, TodoWrite with a token | passed on as the token |
| Any other tool with a token (Bash, WebFetch, MCP …) | refused, so the value never leaves |
| A token the mod no longer knows (after a restart) | refused, never restored wrongly |

**Cut-short output.** Before Read, Grep or Bash runs, every file the call names (Bash: each word
that is an existing file, up to 10 of 1 MB) is scanned whole, so `cut -c1-60 .env`,
`cut -d= -f2` or a Read of a few lines from a PEM key still come back as tokens. Multi-line
secrets are hidden line by line.
Bash words resolve against the directory each segment runs in (`cd sub && cut -c1-40 .env`),
and `~/`, `$HOME/` and `${HOME}/` expand to the home directory.

**Rules.** betterleaks' defaults plus `redact/betterleaks.toml`: Sentry DSN keys, and client
secrets too short for the generic rules. A client secret containing `dev`, `local`, `test`,
`example`, `changeme` or `placeholder` stays visible, so local dev clients keep working in commands.

**Not covered:**

- images; output with no file behind it, cut short (`git show HEAD:.env | cut …`,
  `printenv | cut …`); the transcript file's structured tool records, which keep real values
  (the model does not read them).
- the cut-short pre-scan misses globs (`cut -c1-40 *.env`) and quoted paths with spaces.
- values shorter than 8 characters are never hidden.
- a value restored into a file by Write/Edit can be read back transformed (`base64`, `rev`,
  `xxd`) or sent (`curl -T file`). redact keeps secrets out of the model's context by accident;
  it is not a sandbox against a model trying to get them.
- a subagent's report that quotes a `‹secret:…›` token is refused like any other tool call
  carrying one.

The vault lives in session memory: `/exit` forgets it.

The status line shows `redacted N`: N counts vault entries, so a PEM key counts once per line.
A toast names the rule for each new value it hides. Without betterleaks the status line says
`off (no betterleaks)` and nothing is hidden. A betterleaks run that fails leaves that call
unredacted (values already in the vault stay hidden): one toast per failure streak, the status
says `off (betterleaks)`, and the next call scans again.


## mem-guard: memory rules for Bash

Every Bash command that names a Node tool (`node`, `npx`, `pnpm`, `npm`, `yarn`, `nx`, `jest`,
`vitest`, `playwright`, `tsc`, `ngc`) runs as
`systemd-run --user --scope --slice=claude-cmd.slice -p MemoryMax=8G -p MemorySwapMax=1G -- bash -c '…'`,
so an overrun dies with exit 137 instead of taking the desktop down. Leading `cd … &&` stay
outside the wrapper, so the shell's directory still moves.

The rules read what each part of a command runs (after `&&`, `|`, `;`, `&`, `$( )`, inside
`bash -c '…'`, following `cd`), never words it only mentions, so a commit message saying
`pkill -f` passes. Not looked into: `xargs`, `make`, `eval`, scripts.

**Assumes** this setup; the messages name it:

- a `claude-cmd.slice` user unit. Without it systemd makes the slice with no limit of its own:
  each command is still capped at 8G, but the headroom check has nothing to measure and stays off:
  ```ini
  # ~/.config/systemd/user/claude-cmd.slice
  [Slice]
  MemoryMax=8G
  MemorySwapMax=1G
  ```
- repos whose heavy scripts have a `:lite` twin (`lint:affected:lite`, `typecheck:lite`,
  `test:affected:lite`) and a slow `ci:local` script.

## usage-percent: not covered

- On GitHub only the newest workflow run of the branch is shown.
- A remote using an SSH host alias (`git@work:org/repo`) reads as `pipe no login (work)` though
  you are logged in.

## herdr: images and links

Under herdr (here inside Ghostty), quiet-bash's thumbnails draw only their
alt text, and links in mr-banner, coderabbit-band and Claude's own output aren't clickable.

**Cause:** Claude Code turns on kitty graphics only for terminals whose `XTVERSION` answer is
`kitty` (≥ 0.28) or starts with `ghostty`, and hyperlinks only for terminals it recognises. herdr
forwards both, but answers with its own name, so Claude Code turns both off.

**Fix:** force both on, inside herdr only, before Claude Code starts (it reads them at startup):

```sh
# ~/.bashrc.d/herdr-terminal.sh
if [ -n "$HERDR_ENV" ]; then
    export CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1
    export FORCE_HYPERLINK=1
fi
```

Also turn on herdr's kitty graphics passthrough (off by default) in `~/.config/herdr/config.toml`:

```toml
[experimental]
kitty_graphics = true
```

Then `herdr server reload-config`, open a **new** herdr pane (old panes keep the old environment)
and start Claude Code there. Check it: `/thumb /path/to/some.png` should draw the picture.

### herdr-link-toast (a herdr plugin, not a Claude Code mod)

herdr opens a ctrl+clicked link in the background with no feedback, and ignores `file://` links
altogether. [herdr-link-toast](herdr-link-toast/) opens `http(s)` links with `xdg-open` and shows a
toast. It also opens the path in quiet-bash's thumbnail captions, which link to
`http://localhost/open-file/<path>` because `file://` isn't clickable in herdr. Such a link opens
only when the path ends in `.png`; any other gets a "Could not open link" toast. Needs `python3`.
Install:

```sh
herdr plugin link ~/.claude/skills/herdr-link-toast
```

Without herdr, in plain kitty or Ghostty, none of this is needed. Terminals without the kitty
graphics protocol show the thumbnail's alt text (its path).

## Developing

Each mod is `.claude-plugin/plugin.json`, `hooks/hooks.json` and `hooks/register.ts(x)`, plus
`types/index.d.ts` when it keeps session state. Per mod:

```sh
claude plugin validate <mod>   # what it hooks and calls, and what the engine would refuse
claude plugin test <mod>       # its *.test.ts(x)
tsc -p <mod>                   # once the engine has laid .claude-plugin/types/
```

Edits in `~/.claude/skills` hot-reload into running sessions that loaded the mod.
