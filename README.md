# claude-code-mods

Personal Claude Code mods: plugins of function hooks that restyle the transcript, add rows around
the prompt and react to tool calls. Built and used on Claude Code 2.1.287+, Linux.

## Mods

| Mod | What it does | Commands | Needs |
|---|---|---|---|
| [quiet-bash](quiet-bash/) | One-line tool rows (`✓ <description>`, red `✗ exit N` on failure, `+N −M` on edits, duration for calls ≥10 s). Hides every tool's result block (Bash output, Edit diffs, WebFetch, MCP and Agent results; interactive tools, SendUserFile and image Reads keep theirs), finished read-only rows (Read/Grep/Glob, and calls the engine ran read-only like `ls` or `git status`, and every Claude in Chrome step but `navigate`), collapsed tool groups unless one failed, and timed-out GitLab pipeline-wait notices. Inline PNG thumbnails under rows that read, sent or wrote a PNG, relative paths included | `/quiet` brings it all back; `/thumb [big] <path>` shows a PNG | ImageMagick (`magick`) for thumbnails; a terminal with kitty graphics (see [herdr](#herdr-images-and-links)) |
| [quiet-spinner](quiet-spinner/) | Plain spinner words (`thinking`, `writing`, `running`) and `Took 1m 4s` instead of the whimsical ones | – | – |
| [usage-percent](usage-percent/) | Row under the prompt: `ctx 34% \| 5h 41% \| wk 86%`, yellow from 80 %, red from 95 %. In Nx repos also memory in the middle (`claude.slice` usage + `app.slice` pressure) and on the right the session's own `nx serve` projects (`▶ admin api`) and the branch's pipeline (`ci ⏳ test`, `⏸` when it waits on a manual job) | – | `gh` / `glab` logged in for the pipeline; systemd `claude.slice` for memory |
| [reminder-log](reminder-log/) | Tallies the reminders Claude Code injects for the model, per session; drops the token counter and repeated commit attribution blocks | `/reminders` prints the tally of the last 30 days | – |
| [mr-banner](mr-banner/) | Colored card with a link under each MR/PR created, merged, approved or reviewed | – | GitLab MCP server named `gitlab`, or `glab` / `gh` |
| [coderabbit-band](coderabbit-band/) | Band above the prompt with the open CodeRabbit threads (by severity) and nitpicks of the current branch's GitLab MR, with a link. Shows only when something is open | `/coderabbit` hides it until the counts change | `glab` logged in; GitLab remote |
| [redact](redact/) | Secrets in prompts and tool output reach the model as `‹secret:…›` tokens; only Write/Edit turn them back into the real value. See [redact](#redact-secrets-as-tokens) | – | `betterleaks` on `PATH` |
| [mem-guard](mem-guard/) | Bash commands that run Node tools go into a memory-capped `claude-cmd.slice` scope. Refused, with the fix in the message: `nx affected`/`run-many` without `--parallel=1`, a pnpm script that has a `:lite` twin, jest without a worker cap, `pkill -f`/`pgrep -f` with an unbracketed pattern, `ci:local`, heavy runs while the slice is above 75 % or under pressure, a third heavy command or a third dev server at once, and writes by a `check-runner` subagent. See [mem-guard](#mem-guard-memory-rules-for-bash) | – | Linux with systemd: a user `claude-cmd.slice`, `ps`; see [mem-guard](#mem-guard-memory-rules-for-bash) |
| [handover](handover/) | Skill plus mod: the `handover` skill writes a one-sentence handover for a cold session to `~/.claude/handover.md`; the mod files it per session under `~/.claude/handovers/<session id>.md`, so parallel sessions in one repo never overwrite each other. A band above the prompt shows it; after `/clear` that session's sentence waits in the prompt (Tab takes it) and the next prompt spends it. A new terminal suggests nothing but lists the repo's open sentences (newest first, 14 days) | `/handover-copy` copies it and hides the band; `/handover` lists, `/handover N` puts one in the prompt | –
| [herdr-notify](herdr-notify/) | GNOME popup when Claude waits for a permission, an answer or a new prompt (a `Notification` hook, not a plugin). Skipped while that pane is the focused one in herdr. Clicking it raises Ghostty and focuses that session's herdr pane. Hook: `"Notification": [{"matcher": "permission_prompt\|idle_prompt\|elicitation_dialog", "hooks": [{"type": "command", "command": "bash \"$HOME/.claude/skills/herdr-notify/notify.sh\""}]}]` | – | herdr, Ghostty, `notify-send`, `jq` |
| [stack-down](stack-down/) | On `/clear` and exit, stops what the session's repo left running: its `nx` processes (with their workers) and its Docker Compose projects (`compose down`, volumes kept). Only for a session at a repo's top level (`git rev-parse --show-toplevel`); one started above the repos, such as `~/Dev`, stops nothing | – | `docker compose`, `git` |

The model sees exactly what it would without them: the mods change what is drawn, except
reminder-log, which drops two kinds of injected reminders, redact, which hides secrets, mem-guard,
which runs Node commands inside a systemd scope and refuses some with a `mem-guard: …` error, and
stack-down, which stops a repo's servers and Compose stacks when its session ends.

Three mods call out on their own:

- **mr-banner**, when a GitLab MCP note or approval answers without the MR's link, calls
  `get_merge_request` on the `gitlab` MCP server for the link and title. `gh`/`glab` commands
  cost nothing extra.
- **coderabbit-band** polls `glab` for GitLab `origin` remotes: a 60 s timer checks the branch,
  and a fetch (`glab mr view` plus all pages of the MR's discussions) runs every minute for
  15 min after a `git push`, every 5 min while the band shows something, every 15 min otherwise,
  and once 5 s after a thread is resolved.
- **usage-percent**, in Nx repos, polls every 10 s: `ps` and `pwdx` for `nx serve` processes, and
  `docker inspect` once per container a server runs in, to read its compose project directory.
  The pipeline (`gh run list` / `glab ci get`) is fetched when HEAD moves, 15 s after a `git push`,
  every minute while it runs and every 5 min otherwise.

## Install

**From the marketplace** (gets updates; herdr-notify and herdr-link-toast are not in it):

```sh
claude plugin marketplace add schreibse/claude-code-mods
claude plugin install quiet-bash@schreibse-mods   # per mod
```

Then turn on updates: `/plugin` → Marketplaces → `schreibse-mods` → Enable auto-update. See
[Updates](#updates).

**From a clone**, to adapt a mod or work on it. Claude Code loads every plugin folder under
`~/.claude/skills/` at session start. Don't install the same mod from the marketplace too: the
installed copy silently replaces the folder.

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

**Leave a mod out:** `claude plugin uninstall <mod>@schreibse-mods`, or delete or unlink its
folder. **Try one for a single session:**
`claude --plugin-dir ~/src/claude-code-mods/<mod>`.

**Where they run.** Built and used only in the terminal CLI on Fedora (Linux, systemd, cgroup v2).
The engine also loads user-scope mods in the local session the desktop app starts for its Code tab,
and draws them there (`desktop` surface); untested here. See [Setting up](#setting-up-on-another-machine-for-ai-agents)
for what each mod needs.

**This repo is the skills folder itself**, so `.gitignore` ignores everything and re-includes each
mod: a new mod needs a `!/<name>/` line or git won't see it. `.claude-plugin/types/` is generated
by the engine and stays untracked.

## Updates

Each mod has its own version (`plugin.json`) and a `CHANGELOG.md` in its folder; each release is a
git tag `<mod>--v<version>`.

- **Get them:** with auto-update on, Claude Code updates the mods after a session's first message
  and says `Plugin updated: <mod> · Run /reload-plugins to apply`. Without it nothing tells you;
  check by hand:
  ```sh
  claude plugin marketplace update schreibse-mods
  claude plugin update quiet-bash@schreibse-mods   # per mod; "already at the latest version" if none
  ```
- **What changed:** the mod's `CHANGELOG.md`. Read every version you skipped: a major version
  means you have to act (a new hook in `settings.json`, a new dependency, a removed command).
- **Notified outside Claude Code:** on GitHub, Watch → Custom → Releases. Each release carries the
  mod's changelog entry.
- **From a clone:** `git -C ~/.claude/skills pull --ff-only`, then read the changelogs of the mods
  whose version moved (`git -C ~/.claude/skills diff ORIG_HEAD -- '*/.claude-plugin/plugin.json'`).

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

**Cut-short output.** Before Bash or any tool with a `file_path`/`path` (Read, Grep, Edit …) runs, every file the call names (Bash: the first 10
words that could be paths, files up to 1 MB) is scanned whole, so `cut -c1-60 .env`,
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
`systemd-run --user --scope --slice=claude-cmd.slice -p MemoryMax=30% -p MemorySwapMax=4% -- bash -c '…'`,
so an overrun dies with exit 137 instead of taking the desktop down. Leading `cd … &&` stay
outside the wrapper, so the shell's directory still moves.

The rules read what each part of a command runs (after `&&`, `|`, `;`, `&`, `$( )`, inside
`bash -c '…'`, following `cd`), never words it only mentions, so a commit message saying
`pkill -f` passes. Not looked into: `xargs`, `make`, `eval`, scripts.

**At once,** counted per scope in `claude-cmd.slice` from one `ps` scan (skipped when `ps` fails):

- at most 2 heavy commands (jest, vitest, Playwright, `tsc`, `ngc`, an nx task); the nx daemon and
  dev servers don't count;
- at most 2 dev servers (`nx serve`, `nx run x:serve`, a `serve*` script): the API and one app.

**check-runner subagents** (an agent type of the owner's) only run checks: git commands that change
the tree or history, `sed -i`, `--write`/`--fix`, starting or stopping servers or processes, and
writes outside `/tmp` are refused with "Report the failure instead of fixing it".

**Assumes** this setup; the messages name it:

- a `claude-cmd.slice` user unit. Without it systemd makes the slice with no limit of its own:
  each command is still capped at 30 % of RAM, but the headroom check has nothing to measure and stays off:
  ```ini
  # ~/.config/systemd/user/claude-cmd.slice
  [Slice]
  MemoryMax=30%
  MemorySwapMax=4%
  ```
  systemd turns a percentage into bytes of the machine's RAM (on 27 GiB: 8.2G and 1.1G), so the
  same unit fits any machine. Check what a machine gets:
  `systemd-run --user --scope -q -p MemoryMax=30% -- sh -c 'cat /sys/fs/cgroup$(cut -d: -f3 /proc/self/cgroup)/memory.max'`
- a dev API served on port 4700: the refusal messages say `fuser -k 4700/tcp`.
- repos whose heavy scripts have a `:lite` twin (`lint:affected:lite`, `typecheck:lite`,
  `test:affected:lite`) and a slow `ci:local` script.

## usage-percent: not covered

- On GitHub only the newest workflow run of the branch is shown.
- A remote using an SSH host alias (`git@work:org/repo`) reads as `ci no login (work)` though
  you are logged in.
- A server counts as the session's when it runs inside the session's root, or in a container whose
  compose project lives there. Two sessions on one checkout both see its servers.

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

## Setting up on another machine (for AI agents)

Read before installing for someone. The mods were written for one machine; several carry its names
and need Linux.

**1. Check the host.** Mods need Claude Code 2.1.287+. They load in the terminal CLI and, from
`~/.claude/skills`, in a desktop app's local Code-tab session. A desktop-app session can also be
given a folder through `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json`.
Nothing here has been tried in the desktop app, VS Code, JetBrains, macOS, WSL or native Windows:
say so to the person instead of promising it works.

**2. Pick mods by platform.**

| Works anywhere | Needs Linux | Never on macOS or Windows |
|---|---|---|
| quiet-spinner, reminder-log, mr-banner, coderabbit-band, redact (with `betterleaks`), handover; usage-percent's `ctx/5h/wk` and pipeline parts | usage-percent's memory and dev-server parts (cgroup v2, `/proc`, `pwdx`; they stay empty elsewhere) | **mem-guard**: it wraps every Node command in `systemd-run`, so without systemd every `node`/`pnpm`/`nx` call fails. Leave it out. herdr-notify, herdr-link-toast: Linux, herdr, Ghostty, GNOME |

- **Windows:** quiet-bash, redact and handover read POSIX paths (`/`, `~`). There, quiet-bash
  thumbnails and redact's Bash pre-scan find nothing, and handover leaves spent files behind.
- **Surfaces:** quiet-bash thumbnails draw only in a terminal with kitty graphics (kitty, Ghostty).
  Bands and the usage row show in the terminal and the desktop app, not in VS Code or on mobile.
  `/handover-copy` can't copy from the desktop app.

**3. Adapt to the OS you are on.** The mods do not detect the OS; you are running on it, so adapt
the person's copy and test it there. The plugin API has no OS call: on Windows `$.env.get('OS')` is
`Windows_NT`, elsewhere `uname -s` says `Darwin` or `Linux`. Known gaps:

- **mem-guard** off Linux: leave it out. To keep its command-only rules (jest worker cap, `:lite`,
  `pkill -f`, `ci:local`), skip `scoped()` and the `ps`/cgroup checks when `systemd-run` is missing.
- **handover** on Windows: `HOME` may be unset (`USERPROFILE`), and spent sentences are removed
  with `rm`.
- **quiet-bash, redact** on Windows: path parsing knows `/` and `~` only, not `C:\…`.
- **usage-percent** on macOS: no `pwdx` (`lsof -a -d cwd -p <pid>` instead); the memory zone needs
  cgroup v2 and stays empty.
- **herdr-notify, herdr-link-toast**: Linux, herdr and GNOME only; another OS needs its own
  notifier, not a port.

Write each OS change as its own commit with a test, so it can come back upstream.

**4. Replace the owner's names.** Names in this README and in the messages are examples from the
owner's repos; use the person's own. The API project there is `ec-api`, not `api`, and the
dev-server rules only work with the real project names: read them from the repo
(`npx nx show projects`).

| Mod | Owner-specific | Where |
|---|---|---|
| mem-guard | `claude-cmd.slice` and its 30 % / 4 % limits; port 4700; `:lite` scripts; `ci:local` "~45 min"; the `check-runner` agent type; 2 heavy commands, 2 dev servers | `hooks/rules.ts`, `hooks/register.ts` |
| usage-percent | `claude.slice` (usage) and `app.slice` (pressure) under the user manager; Nx repos only (`nx.json`) | `hooks/register.tsx` |
| mr-banner, coderabbit-band, quiet-bash | the GitLab MCP server named `gitlab` (`mcp__gitlab__…`) | `hooks/*.ts(x)` |
| coderabbit-band, usage-percent | any remote that isn't GitHub (or Azure) is taken for GitLab | `hooks/register.tsx` |
| herdr-notify | Ghostty's desktop entry `com.mitchellh.ghostty` | `notify.sh` |

**5. Install and check.** Install as above (from a clone when you adapted a mod: an update replaces a marketplace copy), then run `claude plugin validate <mod>` and
`claude plugin test <mod>` for each mod you install. Start a new session and check what the person
should now see: the usage row, a tool row with `✓`, and for redact, `redacted 0` in the status line.

## Developing

Each mod is `.claude-plugin/plugin.json`, `hooks/hooks.json` and `hooks/register.ts(x)`, plus
`types/index.d.ts` when it keeps session state. Per mod:

```sh
claude plugin validate <mod>   # what it hooks and calls, and what the engine would refuse
claude plugin test <mod>       # its *.test.ts(x)
tsc -p <mod>                   # once the engine has laid .claude-plugin/types/
```

Edits in `~/.claude/skills` hot-reload into running sessions that loaded the mod.

### Releasing a mod

Marketplace users only get a change once the mod's `version` moves, so a change meant for them
bumps it in the same commit:

1. Bump `version` in `<mod>/.claude-plugin/plugin.json`: major when users must act, minor for a
   feature, patch for a fix.
2. Add `## <version> — <date>` to `<mod>/CHANGELOG.md`, with an **Action needed** line on a major.
3. `claude plugin validate --strict .` (the marketplace) and `claude plugin validate --strict <mod>`.
4. Commit and push, then `claude plugin tag --push <mod>`.
5. `gh release create <mod>--v<version> --verify-tag --title "<mod> <version>" --notes-file <entry>`,
   with the new changelog entry as the notes; links in it must be absolute.
