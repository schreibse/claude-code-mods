import type { Handover } from '../types'

export const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

export function handoverPath(home: string): string {
  return `${home}/.claude/handover.md`
}

export function storeKey(root: string): string {
  return `handover:${root}`
}

// A sentence from another day may describe work since redone; two weeks is the cut.
export function isFresh(handover: Handover | undefined, now: number): handover is Handover {
  return handover !== undefined && handover.text !== '' && now - handover.at < MAX_AGE_MS
}

// The skill writes the sentence alone; a quote marker or surrounding blank lines are not part of it.
// A leading `!` (a GitLab MR ref) would send the pasted prompt to bash, so it gets a word in front.
export function sentenceOf(content: string): string {
  const sentence = content.trim().replace(/^>\s?/gm, '').replace(/\s*\n\s*/g, ' ')
  return sentence.startsWith('!') ? `MR ${sentence}` : sentence
}
