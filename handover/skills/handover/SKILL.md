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
2. Send the sentence, and nothing else, to the `mcp__handover__HandoverSave` tool (`{ sentence }`);
   no file is written. The handover mod keeps it per session, so parallel sessions never overwrite
   each other; a second call replaces this session's sentence. It shows a band above the prompt
   (`/handover-copy` copies it), and after `/clear` this session's sentence waits in the prompt (Tab
   takes it). A new terminal lists the repo's open sentences instead (the folder's, outside a repo);
   `/handover-pick N` puts one in the prompt, and `/handover-pick drop N` removes one. A sentence sent in a prompt, by Tab or pasted, leaves the list.
3. In chat, show it as a quote under "Handover for a new session:", and again in a fenced code
   block: the band and Tab live only in the terminal, and the block's copy button is how the web and
   phone clients take it. Then say in one line what is left to clean up (a local branch, a
   worktree) and ask before deleting any of it.

## "Handover N" from the user

It is line N of the band, which you cannot see. The `mcp__handover__HandoverList` tool returns that
list, numbered the same way: this session's place, newest first. A sentence's `root` is the git repo of the file the session wrote last (the plan file
from step 1), else the folder the session started in; a session's place is the repo it started in,
else that folder. When one turns out to be done, say so and suggest `/handover-pick drop N`.
