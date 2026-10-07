---
name: handover
description: Write the one-sentence handover that lets a cold session continue the work after /clear. Use WITHOUT being asked when an MR/PR has merged, or a task or issue is done and the next one is known; also when the user asks for a handover, a restart sentence or what to paste into a new session.
---

# Handover

One sentence the user pastes into a fresh session after `/clear`. The session that reads it knows
nothing else, so the sentence carries everything needed to start.

## The sentence

- **What landed:** the MR/PR and its number, what it did in a few words, the merge commit (short
  sha) and branch it is on.
- **What is next:** the issue or task by number and in a few words, plus any constraint the next
  session would otherwise get wrong (a rule from a review, a decision, an invariant).
- **Where to start:** the plan file to read first, by repo-relative path.

One sentence, however long; semicolons and an em dash are fine. **Never start it with `!`** — the
prompt reads a leading `!` as bash mode, so a GitLab MR opens as `MR !2376 (…)`, not `!2376 (…)`. No greeting, no "you", no list.
Names exact: numbers, shas, paths. Nothing the next session can find faster itself (the diff, the
commit list).

Example: `PR #146 (#130 notifications: the bell, the list and its desktop panel, seen per subject)
merged as 5fd98a4 on main; next is #132 (reply notifications, the organisers' hourly email), which
must keep notifications rows to ids and counts because the owner role reads them — read
.claude/plans/130-notifications.md first.`

## Steps

1. Bring the plan file up to date first: it is what the next session reads.
2. Write the sentence, and nothing else, with the Write tool to `~/.claude/handover.md`
   (overwrite it). The handover mod picks it up from there: a band above the prompt (`/handover-copy`
   copies it), and after `/clear` the sentence waits in the prompt as a suggestion (Tab takes it).
3. In chat, show it as a quote under "Handover for a new session:", then say in one line what is
   left to clean up (a local branch, a worktree) and ask before deleting any of it.
