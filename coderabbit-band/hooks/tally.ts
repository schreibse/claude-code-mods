import type { Severity, Tally } from '../types'

type Note = { author?: { username?: string }; body?: string; resolvable?: boolean; resolved?: boolean; created_at?: string }
type Discussion = { notes?: Note[] }

export const SEVERITIES: readonly Severity[] = ['critical', 'major', 'minor', 'trivial', 'other']
export const ICONS: Record<Severity, string> = { critical: '🔴', major: '🟠', minor: '🟡', trivial: '🔵', other: '⚪' }

const isRabbit = (note: Note | undefined) => /coderabbit/i.test(note?.author?.username ?? '')

// A thread opens with `_🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_`.
export function severityOf(body: string): Severity {
  const label = /^_[^_\n]+_ \| _[^\w_\n]*(\w+)_/.exec(body)?.[1]?.toLowerCase()
  return SEVERITIES.find(severity => severity === label) ?? 'other'
}

// `glab api --paginate --output ndjson` prints one discussion per line, across all pages.
export const discussionsIn = (ndjson: string): Discussion[] => ndjson.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line) as Discussion)

export function tallyOf(discussions: readonly Discussion[], ref: string, url: string): Tally | null {
  const firsts = discussions.flatMap(discussion => (isRabbit(discussion.notes?.[0]) ? [discussion.notes![0]!] : []))
  if (firsts.length === 0) {
    return null
  }
  const open = Object.fromEntries(SEVERITIES.map(severity => [severity, 0])) as Record<Severity, number>
  for (const note of firsts) {
    if (note.resolvable && !note.resolved) {
      open[severityOf(note.body ?? '')] += 1
    }
  }
  const reviews = firsts.filter(note => /Actionable comments posted|Nitpick comments/.test(note.body ?? ''))
  const latest = reviews.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '')).at(-1)
  const nitpicks = Number(/Nitpick comments \((\d+)\)/.exec(latest?.body ?? '')?.[1] ?? 0)
  return { ref, url, open, nitpicks }
}

export const openCount = (tally: Tally) => SEVERITIES.reduce((sum, severity) => sum + tally.open[severity], 0)

export const isWorthShowing = (tally: Tally | null): tally is Tally => tally !== null && openCount(tally) + tally.nitpicks > 0

// Hiding holds until the counts change.
export const fingerprint = (tally: Tally) => `${tally.ref}:${SEVERITIES.map(severity => tally.open[severity]).join('.')}:${tally.nitpicks}`
