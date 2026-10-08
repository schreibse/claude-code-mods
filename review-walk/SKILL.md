---
name: review-walk
description: Walk the findings of a code review one at a time, asking the user to decide each (fix, issue, skip) before anything is fixed. Use after a review has reported in this conversation (/code-review, /cr, CodeRabbit threads, an MR's comments, a pasted review), when the user says "walk the findings", "go through them one by one" or runs /review-walk.
---

# Review walk

Turns the review reports already in this conversation into one ranked list and has the user decide
each finding before anything changes. The review-walk mod draws the progress; it reads the two
tool calls below, so keep their shape exactly.

## 1. Gather

- Take every finding from the reports in this conversation. No report yet: say so and stop; this
  skill never runs a review itself.
- Merge findings that name the same file, line and cause into one, noting which reviews found it.
- Drop what a report itself marked as refuted or out of scope.
- Rank most severe first: correctness and security, then regressions and data loss, then tests,
  then performance, then design and naming.

## 2. Report the list

Call `ReportFindings` once with the ranked list, **no `outcome` on any finding**. Give each a
`short_summary` (≤60 chars) and a kebab-case `category`. An empty list: say there is nothing to
walk and stop.

## 3. Ask, one finding per question

For finding N of M, one `AskUserQuestion` with exactly one question:

- `header`: `N/M` and nothing else (the mod keys on it).
- `question`: the finding in a sentence, with `file:line`, plus what goes wrong (the failure
  scenario).
- options, your recommendation first and marked `(Recommended)`, labels starting with the
  decision word: `Fix` (what the fix is, and whether it adds new surface to review again),
  `Issue` (defer to a tracked issue), `Skip` (why it is fine as is).

Wait for the answer before asking the next. A free-text answer is the user's decision in their
words: follow it. Fix nothing while questions remain.

## 4. Act

After the last answer:

- Apply every `Fix` decision as one batch; run what checks the repo has for the touched code.
- For each `Issue`, draft the issue text in chat. Filing it is a separate approval.
- Call `ReportFindings` again with the same list, each finding's `outcome` set: `fixed`,
  `skipped` (Issue or Skip), or `no_change_needed`. This closes the walk.
- Summarise in one line per decision.
