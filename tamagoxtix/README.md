# tamagoxtix for Claude Code

A fork of [fabandrade88/tamagoxtix](https://github.com/fabandrade88/tamagoxtix) 2.1.4 (MIT, by
Fabricio Oliveira de Andrade), kept here with the other mods; see [CHANGELOG.md](CHANGELOG.md) for
what differs. The herdr plugin is in [herdr-tamagoxtix](../herdr-tamagoxtix/).

A pixel monster in place of Claude Code's spinner: it acts out what Claude is
doing, hangs out above the prompt between turns next to your usage and your
GitHub or GitLab repo, cheers you on while you type a prompt, and colors everything in one palette.

```sh
claude plugin install tamagoxtix@schreibse-mods   # or clone, see the repo README
```

Run it in a terminal, then open Claude Code in any folder. Then `/tamagoxtix help` lists every command, and `/tamagoxtix doctor` checks
what it needs (Node.js, git, a Nerd Font) — nothing is installed for you. Needs Claude Code 2.1.300+ (the
plugin uses Claude Code's function hooks, an early-access API) and Node.js 18+.

Screenshots, commands and details: [the main README](https://github.com/fabandrade88/tamagoxtix#readme).

## What it runs, reads, writes and sends

Everything TamaGoxtix does happens on your machine, in readable source in this
folder. It sends no analytics and no telemetry, reads no credentials (no
tokens, keys or passwords: `gh` and `glab` sign in on their own), and never
takes commands from a server.

### Programs it runs

Always by argument list (`$.process.run`), never through a shell, and never a
command that comes from the network:

| Program | When | Why |
| --- | --- | --- |
| `node scripts/usage-node.mjs --days 14` (this folder) | at the start of a session and after each turn | to sum token usage from Claude Code's transcripts |
| `git remote get-url origin`, `git rev-parse --abbrev-ref HEAD`, `git status --porcelain`, `git rev-list --left-right --count @{u}...HEAD`, `git describe --tags --abbrev=0` | at the start of a session and after each turn; outside a repository once per folder every ten minutes | the repo column: remote, branch, changed files, ahead/behind, latest tag |
| `gh api repos/<owner>/<repo>`, `gh pr list`, `gh run list` | when `gh` is installed and signed in, at most every ten minutes | the repository's issues, pull requests, stars and last CI run |
| `glab api --hostname <host> projects/<project>…` | when `glab` is installed, at most every ten minutes | the same for GitLab |
| `herdr pane get <pane>`, `herdr pane report-metadata <pane> --source tamagoxtix --token monster=<icon>`, `herdr plugin action invoke tamagoxtix.sidebar-refresh`, `herdr plugin action invoke tamagoxtix.theme-refresh` | only inside a [herdr](https://herdr.dev) pane (`HERDR_PANE_ID` set) | the monster's identity for the pane, its face in herdr's sidebar, and the herdr plugin's palette |
| `node --version`, `git --version`, `gh auth status`, `glab --version` | only when you run `/tamagoxtix doctor` | to say what is installed |

Each command is written out in full at its call in `register.tsx`. The
owner, repository, branch and host in those arguments come from your project's
own git remote, cleaned of control characters; `<pane>` is herdr's own pane id.

`gh` and `glab` use the sign-in you gave them yourself (`gh auth login`,
`glab auth login`). TamaGoxtix never reads, stores or passes on a token, key
or password, and asks for none: without a signed-in `gh` or `glab` it falls
back to the public APIs below, which need no credentials.

### Environment variables it reads

`HOME` (or `USERPROFILE`), `XDG_CONFIG_HOME`, `XDG_STATE_HOME` and
`CLAUDE_CONFIG_DIR`, to find the folders below, and `HERDR_PANE_ID`, to know
it runs inside herdr. Nothing else from the environment.

### Hosts it contacts

Only when `gh` or `glab` is missing or not signed in, it asks the public API of
your project's own forge for the same repository numbers:

- `https://api.github.com/repos/<owner>/<repo>`, for a remote on GitHub (open
  issues and stars only; pull requests and CI need `gh`)
- `https://<your GitLab host>/api/v4/projects/<project>` (and its pipelines and
  merge requests), for a remote on GitLab: gitlab.com or the self-hosted host
  named in your git remote

What it sends is the request itself: the owner, repository and branch names
from your git remote. No file contents, no conversation, no token counts, no
credentials.

### Files it reads

- Claude Code's transcripts in `~/.claude/projects`: only each response's token
  counts, ids and timestamp; message text is never kept
- `~/.claude/settings.json`, Claude Code's settings file: only its `statusLine`
  and `theme` keys are looked at, to show in `/tamagoxtix help` what is on and
  to change them when you ask (below)
- the active Omarchy theme's colors (`~/.config/omarchy/current/theme`), only
  with the `omarchy` palette and only where the file exists
- the project's `package.json`, for its version
- its own config and state (below)

### Files it writes

Every path is fixed and named in full at its write; nothing is written into
your project. (`~/.config` and `~/.local/state` stand for `$XDG_CONFIG_HOME`
and `$XDG_STATE_HOME` when those are set, and `~/.claude` for
`$CLAUDE_CONFIG_DIR`.)

- `~/.config/tamagoxtix/config.json`: your choices (palette, icons, toggles)
- `~/.local/state/tamagoxtix/rerolls.json` and `icons.json`: your monster's
  rerolls and icon pick (`/tamagoxtix reroll`, `/tamagoxtix icon`)
- `~/.local/state/tamagoxtix/limits.json`: the last 5-hour and weekly limit
  readings, for the herdr popup
- `~/.local/state/tamagoxtix/usage-cache.json`: written by
  `scripts/usage-node.mjs`, a cache of short ids, timestamps and token counts
- `~/.local/state/tamagoxtix/statusline/statusline.mjs`, `palettes.mjs`,
  `powerline.mjs` and `forge.mjs`: copies of this folder's `scripts/` files, in
  a place that survives plugin updates, only with the status line on
- once, for people upgrading from TamaGoxtix's old name: `config.json`,
  `rerolls.json`, `icons.json` and `limits.json` copied from `tamaclaude/` to
  `tamagoxtix/` in the same folders, never over a file already there

**This mod edits Claude Code's settings file**, `~/.claude/settings.json`, but
only when you ask it to, with these commands:

- `/tamagoxtix statusline on|off` sets or restores the `statusLine` key
  (pointing it at the status line copy above), and `/tamagoxtix theme on|off`
  sets or restores the `theme` key. No other key changes. A file that isn't
  valid JSON is left alone; the first change keeps a copy as
  `~/.claude/settings.json.tamagoxtix-backup`; the file is read back and
  restored if anything went wrong.
- `/tamagoxtix theme on` also writes the chat theme file
  `~/.claude/themes/tamagoxtix.json`, rewritten when you switch palettes while
  it is on.
- The one-time upgrade from tamaclaude repoints those same two keys, only when
  they still point at tamaclaude's old status line or theme.

Before uninstalling, run `/tamagoxtix statusline off` and `/tamagoxtix theme off`
to give those settings back.

### What its hooks do

| Hook | What it does |
| --- | --- |
| `session.start`, `session.end` | loads your palette and monster; registers `/tamagoxtix` |
| `turn.start`, `turn.complete` | starts and stops the spinner's clock; refreshes usage and the repo column |
| `turn.step` | counts the characters Claude streams, to estimate the token bar while a turn runs; the text is never kept or sent |
| `session.measure` | keeps Claude Code's 5-hour and weekly limit readings for the bars |
| `prompt.edit` | looks at whether the prompt box holds a prompt, to cheer you on while you type; it passes every edit on unchanged and never keeps or sends the text |
| `ui.render` (`Spinner`, `AbovePrompt`, `CommandOutput` of `/tamagoxtix`) | draws the monster, the band above the prompt and the cards |
| `command.run` (only `/tamagoxtix`) | answers its own command; other commands are not touched |

It registers one command, `/tamagoxtix`, and no tools or agents. It answers no
permission prompts and changes no other plugin's calls. The `scripts/` files
are Node.js programs it runs with `node` (above), not mod code.

## License

MIT, see [LICENSE](LICENSE).
