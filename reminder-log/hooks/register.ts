import type { EngineInterface, Register } from 'claude-code'
import { KEPT_PREFIX, TALLY_PREFIX, current, merge, record, report, shouldDrop, staleKeys, type Tally } from './tally'

async function readTallies($: EngineInterface): Promise<Record<string, Tally>> {
  const keys = (await $.store.keys()).filter(key => key.startsWith(TALLY_PREFIX))
  const tallies = await Promise.all(keys.map(async key => [key, (await $.store.get(key)) as Tally] as const))
  return Object.fromEntries(tallies)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'reminders', description: 'Show the tally of injected reminders by type and size' })
    const stale = staleKeys(await readTallies($), await $.clock.now())
    // 'tally' is the single all-session tally from before per-session keys.
    await Promise.all(['tally', ...stale].map(key => $.store.delete(key)))
    return next(e)
  })

  // The attribution block leaves the context with a compaction, so the next one is sent again.
  on('classic.SessionStart', { source: 'compact' }, async ($, e, next) => {
    await $.store.delete(KEPT_PREFIX + (await $.session.id()))
    return next(e)
  })

  on('command.run', { command: 'reminders' }, async $ => {
    const now = await $.clock.now()
    const tallies = Object.values(await readTallies($)).filter(tally => current(tally, now) !== undefined)
    return { text: report(merge(tallies), tallies.length) }
  })

  on('prompt.attachment', async ($, e, next) => {
    const session = await $.session.id()
    const keptKey = KEPT_PREFIX + session
    const isDropped = shouldDrop(e.type, e.text, (await $.store.get(keptKey)) as string | undefined)
    const result = isDropped ? { text: null } : await next(e)
    if (e.type === 'remote_session_change' && !isDropped) {
      await $.store.set(keptKey, e.text)
    }
    const now = await $.clock.now()
    const tallyKey = TALLY_PREFIX + session
    const tally = current((await $.store.get(tallyKey)) as Tally | undefined, now)
    await $.store.set(tallyKey, record(tally, e.type, e.origin.kind, e.text, new Date(now).toISOString(), isDropped))
    return result
  })
}
