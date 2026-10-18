# task-meter changelog

## 0.3.0 — 2026-10-18

- The bar, progress, memory and time columns follow the longest label at a gap of eight spaces instead of sitting at the band's right edge.

## 0.2.0 — 2026-10-18

- The bars are ten cells wide instead of four.

## 0.1.0 — 2026-10-18

First versioned release. What it does: [README](https://github.com/schreibse/claude-code-mods#readme).
One row per running task above the prompt: background shells, foreground shells after 5 s, subagents
with their shells as child rows, workflows and monitors. Each row has a four-cell bar (filled where
the output says `[N/M]`, a percentage or an nx task count, otherwise one cell walking), the progress
text or the subagent's tool count, the process tree's memory and the running time, in aligned columns.
