# repo-line changelog

## 0.1.0 — 2026-10-18

First release. A line right above the prompt: the repository's name as a badge on the repository's own
colour, then the branch (`@abc1234` when detached) and `(wt: name)` in a linked worktree. Each new repository
gets the next hue of a golden-angle sequence, kept in the plugin's store, so colours stay apart and never
change; `/repo-line color <hue|#rrggbb>` overrides one, `/repo-line color reset` drops the override.
