# claude-code-mods

Personal Claude Code mods: plugins of function hooks that restyle the transcript, add rows around
the prompt and react to tool calls. Built and used on Claude Code 2.1.287+, Linux.

## Mods

| Mod | What it does | Commands | Needs |
|---|---|---|---|
| [quiet-bash](quiet-bash/) | One-line tool rows (`✓ <description>`, red `✗ exit N` on failure, duration for calls ≥10 s); hides successful reads and Bash output; inline PNG thumbnails under rows that read or wrote a PNG | `/quiet` toggles full rows; `/thumb [big] <path>` shows a PNG | ImageMagick (`magick`) for thumbnails; a terminal with kitty graphics (see [herdr](#herdr-images-and-links)) |
| [quiet-spinner](quiet-spinner/) | Plain spinner words (`thinking`, `writing`, `running`) and `Took 1m 4s` instead of the whimsical ones | – | – |
| [usage-percent](usage-percent/) | Row under the prompt: `ctx 34% \| 5h 41% \| wk 86%▲`. In Nx repos also memory (`claude.slice` + `app.slice` pressure), running `nx serve` projects and the branch's pipeline | – | `gh` / `glab` logged in for the pipeline; systemd `claude.slice` for memory |
| [reminder-log](reminder-log/) | Tallies the reminders Claude Code injects for the model, per session; drops the token counter and repeated commit attribution blocks | `/reminders` prints the tally | – |
| [mr-banner](mr-banner/) | Colored card with a link under each MR/PR created, merged, approved or reviewed | – | GitLab MCP server named `gitlab`, or `glab` / `gh` |
| [coderabbit-band](coderabbit-band/) | Band above the prompt with the open CodeRabbit threads (by severity) and nitpicks of the current branch's GitLab MR, with a link. Shows only when something is open | `/coderabbit` hides it until the counts change | `glab` logged in; GitLab remote |

The model sees exactly what it would without them: the mods change what is drawn, except
reminder-log, which drops two kinds of injected reminders.

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
`http://localhost/open-file/<path>` because `file://` isn't clickable in herdr. Install:

```sh
herdr plugin link ~/.claude/skills/herdr-link-toast
```

Without herdr, in plain kitty or Ghostty, none of this is needed. Terminals without the kitty
graphics protocol show the thumbnail's alt text (its path).

## Developing

Each mod is `.claude-plugin/plugin.json`, `hooks/hooks.json` and `hooks/register.tsx`, plus
`types/index.d.ts` when it keeps session state. Per mod:

```sh
claude plugin validate <mod>   # what it hooks and calls, and what the engine would refuse
claude plugin test <mod>       # its *.test.ts(x)
tsc -p <mod>                   # once the engine has laid .claude-plugin/types/
```

Edits in `~/.claude/skills` hot-reload into running sessions that loaded the mod.
