# tamagoxtix changelog

Forked from [fabandrade88/tamagoxtix](https://github.com/fabandrade88/tamagoxtix) at 2.1.4
(commit `7cbd7b2`, MIT, by Fabricio Oliveira de Andrade), synced with 2.1.6 (`dbc8c20`). Upstream's
own history is in that repo.

## 2.2.0 — 2026-10-17

- The band above the prompt passes the render on to the other mods (`next(e)`) and stacks their
  bands under the monster, so handover, review-walk, coderabbit-band and task-meter keep showing.
  Upstream drew its band alone.
- The band no longer shows the 5-hour and weekly bars and the week's days: the limits already sit
  on the prompt hint (usage-percent). The repo column now needs 126 columns instead of 160.
- The effects column beside the monster has a fixed width (11, the widest effect), so the text
  beside the scene stays put instead of shifting when an effect wider than 6 plays.
- `/tamagoxtix animate off`: still scenes (one frame each) in the spinner and the band; the scenes
  still change and the clock still ticks. `animate on` is the default.
- The bands of the mods beneath (task-meter's rows, handover, review-walk…) sit under the caption column,
  indented past the monster, and get told the width that column has (`bodyColumns`).
  The third line (`$ 185M tokens today · /tamagoxtix for stats`) folds into the muted line as `· 185M today`.
- From upstream 2.1.5: the monsters keep their shape on narrow terminals (a scene row never wraps,
  the text beside it is cut with `…`; under 44 columns the band and the spinner are one line, and
  `/tamagoxtix doctor` says so). Upstream 2.1.6 shares the band too, stacking the other bands above
  the monster; this fork keeps them under the caption.
- The spinner's token line (`$ 3.4k ▰▰▱▱▱▱▱▱ tokens`) is gone; `esc to interrupt` sits on the clock line.
  With it the `turn.step` hook that estimated the count from the streamed text.
- Installed from the schreibse-mods marketplace or the skills folder; the herdr plugin is the
  sibling folder `herdr-tamagoxtix`.
