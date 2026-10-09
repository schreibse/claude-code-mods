import type { Handover } from '../types'

export const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

const KEY_PREFIX = 'handover:'

// The path the skill writes; each session's sentence then lands in a file of its own.
export function handoverPath(home: string): string {
  return `${home}/.claude/handover.md`
}

export function expandHome(path: string, home: string): string {
  return path === '~' || path.startsWith('~/') ? `${home}${path.slice(1)}` : path
}

export function sessionPath(home: string, sessionId: string): string {
  return `${home}/.claude/handovers/${sessionId}.md`
}

export function storeKey(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}`
}

export function sessionIdOf(key: string): string | null {
  return key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : null
}

// A sentence from another day may describe work since redone; two weeks is the cut.
export function isFresh(handover: Handover | undefined, now: number): handover is Handover {
  return handover !== undefined && handover.text !== '' && now - handover.at < MAX_AGE_MS
}

export type Entry = { key: string; handover: Handover }

export function choicesFor(entries: readonly Entry[], root: string, now: number): Entry[] {
  return entries
    .filter(({ handover }) => isFresh(handover, now) && handover.root === root)
    .sort((a, b) => b.handover.at - a.handover.at)
}

const oneLine = (text: string): string => text.trim().replace(/\s+/g, ' ')

// A sentence pasted by hand is spent like one taken with Tab, however the terminal rewrapped it.
export function isPastedIn(prompt: string, sentence: string): boolean {
  return sentence !== '' && oneLine(prompt).includes(oneLine(sentence))
}

// `/handover drop N` names an entry of the list; anything else is a pick or a listing.
export function dropIndex(args: string): number | null {
  const match = /^drop\s+([1-9]\d*)$/.exec(args.trim())
  return match === null ? null : Number(match[1])
}

// The skill writes the sentence alone; a quote marker or surrounding blank lines are not part of it.
// A leading `!` (a GitLab MR ref) would send the pasted prompt to bash, so it gets a word in front.
export function sentenceOf(content: string): string {
  const sentence = content.trim().replace(/^>\s?/gm, '').replace(/\s*\n\s*/g, ' ')
  return sentence.startsWith('!') ? `MR ${sentence}` : sentence
}
