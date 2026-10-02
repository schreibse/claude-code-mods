import type { Register } from 'claude-code'

const LEGACY_TALLY = 'tally'
const TALLY_PREFIX = 'tally:'
const KEPT_PREFIX = 'kept-attribution:'
const SAMPLE_CHARS = 160

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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'reminders', description: 'Show the tally of injected reminders by type and size' })
    return next(e)
  })

  on('command.run', { command: 'reminders' }, async $ => {
    const keys = (await $.store.keys()).filter(key => key === LEGACY_TALLY || key.startsWith(TALLY_PREFIX))
    const tallies = (await Promise.all(keys.map(key => $.store.get(key)))) as Tally[]
    return { text: report(merge(tallies), keys.length) }
  })

  on('prompt.attachment', async ($, e, next) => {
    const session = await $.session.id()
    const keptKey = KEPT_PREFIX + session
    const isDropped = shouldDrop(e.type, e.text, (await $.store.get(keptKey)) as string | undefined)
    const result = isDropped ? { text: null } : await next(e)
    if (e.type === 'remote_session_change' && !isDropped) {
      await $.store.set(keptKey, e.text)
    }
    const now = new Date(await $.clock.now()).toISOString()
    const tallyKey = TALLY_PREFIX + session
    const tally = (await $.store.get(tallyKey)) as Tally | undefined
    await $.store.set(tallyKey, record(tally, e.type, e.origin.kind, e.text, now, isDropped))
    return result
  })
}
