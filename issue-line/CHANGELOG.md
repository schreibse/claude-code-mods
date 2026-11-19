# issue-line changelog

## 0.1.0 — 2026-11-19

First release. At the right end of the hint line under the prompt: `issue #1234 <title…> · mr !5678 · ci ✓ ·
threads ✓`, in usage-percent's look (dim labels, colour only for a state). Number, title and MR are links.
Each session finds its own issue: a `/issue-line` pin (`5`, `#5`, `!5` or a link), else the first issue or MR
its prompts name (`#1234`, `!1234`, `issue 1234`, an `/-/issues/`, `/-/work_items/` or `/-/merge_requests/`
link, looked up in that link's project; not a colour, `line #42` or `PR #12`), else the branch of the folder
its shell commands work in (the last absolute `cd <dir>` or `git -C <dir>`), so parallel sessions in linked
worktrees each show theirs. A resumed or cleared session reads both from its own transcript. Of an issue's MRs
it takes the one on that branch, else the only open one on an `<issue>-…` branch (of all linked ones when none
is), and with several open shows ` · 2 open mrs`. An MR with no issue shows as `mr !5678 <title>`. When Claude
Code's hint line already shows the MR, only its number is left out. A lookup that fails keeps the last line; a
new focus or an issue that does not exist clears it, and `/issue-line` says which. One `glab api graphql` call
per refresh; none for GitHub remotes.

![issue-line in three sessions (rendered sample)](docs/issue-line.png)
