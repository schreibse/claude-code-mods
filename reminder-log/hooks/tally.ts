export const TALLY_PREFIX = 'tally:'
export const KEPT_PREFIX = 'kept-attribution:'
const SAMPLE_CHARS = 160
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000

export type Entry = { count: number; chars: number; origin: string; sample: string; lastSeen: string; dropped?: number }
export type Tally = { since: string; types: Record<string, Entry> }

export function record(tally: Tally | undefined, type: string, origin: string, text: string, now: string, isDropped = false): Tally {
  const base = tally ?? { since: now, types: {} }
  const seen = base.types[type]
  const dropped = (seen?.dropped ?? 0) + (isDropped ? 1 : 0)
  const entry: Entry = {
    count: (seen?.count ?? 0) + 1,
    chars: (seen?.chars ?? 0) + text.length,
    origin,
    sample: text.replace(/\s+/g, ' ').slice(0, SAMPLE_CHARS),
    lastSeen: now,
    ...(dropped > 0 ? { dropped } : {}),
  }
  return { ...base, types: { ...base.types, [type]: entry } }
}

// The token counter is noise; the attribution block matters only when it is new or has changed.
export function shouldDrop(type: string, text: string, lastKeptAttribution: string | undefined): boolean {
  return type === 'total_tokens_reminder' || (type === 'remote_session_change' && text === lastKeptAttribution)
}

export function merge(tallies: readonly Tally[]): Tally | undefined {
  if (tallies.length === 0) {
    return undefined
  }
  const types: Record<string, Entry> = {}
  for (const tally of tallies) {
    for (const [type, e] of Object.entries(tally.types)) {
      const seen = types[type]
      const latest = seen === undefined || e.lastSeen > seen.lastSeen ? e : seen
      const dropped = (seen?.dropped ?? 0) + (e.dropped ?? 0)
      types[type] = {
        ...latest,
        count: (seen?.count ?? 0) + e.count,
        chars: (seen?.chars ?? 0) + e.chars,
        ...(dropped > 0 ? { dropped } : {}),
      }
    }
  }
  const since = tallies.map(tally => tally.since).sort()[0] ?? ''
  return { since, types }
}

export function report(tally: Tally | undefined, sessions = 1): string {
  if (tally === undefined) {
    return 'No reminders logged yet.'
  }
  const rows = Object.entries(tally.types)
    .sort(([, a], [, b]) => b.chars - a.chars)
    .map(([type, e]) => `| ${type} | ${e.origin} | ${e.count} | ${e.dropped ?? 0} | ~${Math.round(e.chars / 4)} | ${e.sample.replace(/\|/g, '\\|')} |`)
  return [
    `Reminders since ${tally.since}, ${sessions} session(s) (tokens ≈ chars / 4):`,
    '',
    '| type | origin | count | dropped | tokens | latest sample |',
    '|---|---|---|---|---|---|',
    ...rows,
  ].join('\n')
}

function lastSeen(tally: Tally): string {
  return Object.values(tally.types).reduce((latest, e) => (e.lastSeen > latest ? e.lastSeen : latest), tally.since)
}

function cutoff(now: number): string {
  return new Date(now - RETENTION_MS).toISOString()
}

/** A tally counts at most the last 30 days: one begun earlier is dropped and starts afresh. */
export function current(tally: Tally | undefined, now: number): Tally | undefined {
  return tally !== undefined && tally.since >= cutoff(now) ? tally : undefined
}

/** Tallies begun over 30 days ago, and the attribution twin of a session idle that long. */
export function staleKeys(tallies: Readonly<Record<string, Tally>>, now: number): string[] {
  return Object.entries(tallies).flatMap(([key, tally]) => [
    ...(current(tally, now) === undefined ? [key] : []),
    ...(lastSeen(tally) < cutoff(now) ? [KEPT_PREFIX + key.slice(TALLY_PREFIX.length)] : []),
  ])
}
