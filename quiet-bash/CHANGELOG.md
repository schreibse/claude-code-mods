# quiet-bash changelog

## 0.1.1 — 2026-10-08

- Relative and `~` paths in SendUserFile and `/thumb` resolve against the session's directory; `/thumb` prints `thumb #N: <path>` and each run keeps its own image.
- Read ranges end at the last line read (`:10-14`, was `:10-15`).
- Only timed-out pipeline waits are hidden; other failures show.
- `a.png.bak` is not a PNG; `cd "dir with space"`, `cd -` and `$HOME` are followed.

## 0.1.0 — 2026-10-08

First versioned release. What it does: [README](https://github.com/schreibse/claude-code-mods#readme).
