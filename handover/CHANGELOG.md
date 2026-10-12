# handover changelog

## 0.3.0 — 2026-10-12

- A sentence is filed under the git repo of the file the session wrote last (the plan file the skill updates first), not the folder the session started in: work in a repo from a session started in its parent folder now shows in that repo.
- Outside any repo a sentence stays with the folder the session started in; a session started in a repo's subfolder lists the repo's sentences.
- The band reads "handovers here", since the place can be a plain folder.

## 0.2.1 — 2026-10-10

- The skill shows the sentence in a code block as well as the quote: the band and Tab are terminal-only, so the web and phone clients copy it from the block.

## 0.2.0 — 2026-10-09

- A sentence pasted into a prompt by hand leaves the list, the same as one taken with Tab.
- `/handover drop N` removes entry N and renumbers the band.
- The skill says where "handover N" comes from: this repo's entries in the mod's store, not the files in `~/.claude/handovers/`.

## 0.1.1 — 2026-10-08

- `/handover N` picks from the list it showed, so another session writing meanwhile can't shift the numbers.
- A sentence written to the literal `~/.claude/handover.md` path is filed per session too.
- The skill moved to `skills/handover/SKILL.md`, so a marketplace install includes it.

## 0.1.0 — 2026-10-08

First versioned release. What it does: [README](https://github.com/schreibse/claude-code-mods#readme).
