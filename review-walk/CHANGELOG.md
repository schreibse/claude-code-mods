# review-walk changelog

## 0.2.1 — 2026-10-27

- Once one finding is `Fix`, the push is coming anyway: later recommendations are made on the finding's merit, not on "another pipeline" or review pressure, and an in-diff defect is a `Fix` rather than a follow-up issue.

## 0.2.0 — 2026-10-08

- New `ReviewWalkDecide` tool: decisions the user authorised up front count in the progress band without a question.
- A walk starts only after the review-walk skill runs; a review reporting findings on its own draws no band.
- The skill moved to `skills/review-walk/SKILL.md`, so a marketplace install includes it.

## 0.1.0 — 2026-10-08

First release. What it does: [README](https://github.com/schreibse/claude-code-mods#readme).
