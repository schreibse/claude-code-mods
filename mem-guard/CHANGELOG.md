# mem-guard changelog

## 0.2.0 — 2026-10-08

- Only commands that run a Node tool get wrapped; a tool named inside quotes (a commit message, an MR title) no longer counts, and `cd x;` stays outside the wrapper like `cd x &&`.
- The slice is looked up again until it exists, so the crowded-slice refusals work even when the session started before any command ran.
- A `)` inside quotes no longer splits a command; `command pkill`, `/usr/bin/pkill` and `npm exec jest` are caught; `pkill -f '[n]x' -9` passes; a percentage `--maxWorkers` is not a worker cap.
- A script is refused only for an exact `<script>:lite` twin (`test:e2e` no longer counts against `test:lite`).
- Dev-server starts count against the dev-server limit only, not the heavy-command limit.
- check-runner writes: every operand of `rm`, `tee`, `touch`, `cp`, `mv` is checked.

## 0.1.0 — 2026-10-08

First versioned release. What it does: [README](https://github.com/schreibse/claude-code-mods#readme).
