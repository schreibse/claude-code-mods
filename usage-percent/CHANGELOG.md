# usage-percent changelog

## 0.2.0 — 2026-10-08

- A GitHub run waiting for approval shows `⏸`; a cancelled GitLab pipeline shows `✗` like GitHub.
- Azure remotes get no pipeline segment instead of `ci no login`.
- A bare `nx serve`, `--project=x` and `run-many -t serve` show under `▶`.
- `git -C dir push` refreshes the pipeline; the poll timer no longer doubles after a resume or reload.

## 0.1.0 — 2026-10-08

First versioned release. What it does: [README](https://github.com/schreibse/claude-code-mods#readme).
