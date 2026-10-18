# usage-percent changelog

## 0.4.0 — 2026-10-18

- A model-scoped weekly window (the plan's Fable or Opus allowance) draws as a fourth bar, labelled by its
  model: `ctx ▰▱▱▱ 34% | 5h ▰▰▱▱ 41% | wk ▰▰▰▱ 86% | fable ▰▰▱▱ 28%`. It comes from the usage endpoint
  through the session's own credential, fetched at most once a minute; without a first-party login
  there is no fourth bar.
- The weekly reset moves to the row's far right as `resets 1d5h`, in its two largest units; the 5h
  window no longer shows one.

## 0.3.0 — 2026-10-17

- The row under the prompt draws each figure as a four-cell bar with the percent, and the 5h and
  weekly windows carry the rounded time to their reset: `ctx ▰▱▱▱ 34% | 5h ▰▰▱▱ 41% ⟳3h | wk ▰▰▰▱ 86% ⟳2d`.
  The bar design comes from tamagoxtix's band.

## 0.2.0 — 2026-10-08

- A GitHub run waiting for approval shows `⏸`; a cancelled GitLab pipeline shows `✗` like GitHub.
- Azure remotes get no pipeline segment instead of `ci no login`.
- A bare `nx serve`, `--project=x` and `run-many -t serve` show under `▶`.
- `git -C dir push` refreshes the pipeline; the poll timer no longer doubles after a resume or reload.

## 0.1.0 — 2026-10-08

First versioned release. What it does: [README](https://github.com/schreibse/claude-code-mods#readme).
