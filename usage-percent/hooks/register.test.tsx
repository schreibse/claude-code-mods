import { expect, mock, test } from 'claude-code/testing'
import { isGitPush, line, resetIn } from './register'

const text = (pieces: readonly { text: string }[]) => pieces.map(p => p.text).join('')

const NOW = Date.parse('2026-10-17T12:00:00Z')

test('shows context and both limit windows as four-cell bars, coloured at 80% and 95%, the weekly reset after a gap', () => {
  const pieces = line({ window: 200000, percent: 34 }, [
    { kind: 'five_hour', percentUsed: 41, resetsAt: '2026-10-17T15:03:00Z' },
    { kind: 'seven_day', percentUsed: 86, resetsAt: '2026-10-19T12:30:00Z' },
    { kind: 'spend_limit', percentUsed: 99 },
  ], NOW)
  expect(text(pieces)).toBe('ctx ▰▱▱▱ 34% | 5h ▰▰▱▱ 41% | wk ▰▰▰▱ 86%        resets 2d')
  expect(pieces.filter(p => p.tone !== 'dim').map(p => [p.text, p.tone])).toEqual([['▰▰▰▱ 86%', 'yellow']])
})

test('a model-scoped week from the usage endpoint follows the weekly bar', () => {
  const pieces = line({ window: 200000, percent: 34 }, [{ kind: 'seven_day', percentUsed: 30, resetsAt: '2026-10-19T22:59:59Z' }], NOW, [
    { label: 'fable', percentUsed: 28, resetsAt: '2026-10-19T22:59:59Z' },
  ])
  expect(text(pieces)).toBe('ctx ▰▱▱▱ 34% | wk ▰▱▱▱ 30% | fable ▰▱▱▱ 28%        resets 2d10h')
})

test('context alone before any rate-limit reading', () => {
  expect(text(line({ window: 200000 }, []))).toBe('ctx ▱▱▱▱ 0%')
})

test('a window at 95% or more turns red', () => {
  expect(line({ window: 200000, percent: 97 }, [])[1]).toEqual({ text: '▰▰▰▰ 97%', tone: 'red' })
})

test('the reset time carries its two largest units and is left out once passed', () => {
  expect(resetIn('2026-10-18T17:30:00Z', NOW)).toBe('1d5h')
  expect(resetIn('2026-10-19T12:20:00Z', NOW)).toBe('2d')
  expect(resetIn('2026-10-17T15:12:30Z', NOW)).toBe('3h12m')
  expect(resetIn('2026-10-17T15:00:00Z', NOW)).toBe('3h')
  expect(resetIn('2026-10-17T12:45:00Z', NOW)).toBe('45m')
  expect(resetIn('2026-10-17T12:00:20Z', NOW)).toBe('1m')
  expect(resetIn('2026-10-17T11:00:00Z', NOW)).toBe('')
  expect(resetIn(undefined, NOW)).toBe('')
})

test('draws the usage in its own row under the hint line', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  mock.clock(on, { now: NOW })
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{e.props.hint}</Text>
  })
  await $.session.measure({
    context: { window: 200000, percent: 34 },
    rateLimits: [{ kind: 'seven_day', percentUsed: 86, resetsAt: '2026-10-19T12:30:00Z' }],
    changed: ['context', 'rateLimits'],
  })

  const ui = await $.ui.mount({
    plugin: 'usage-percent',
    surface: 'terminal',
    component: 'PromptHint',
    props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
  })

  const column = await ui.find({ type: 'Box' })
  expect(column?.props.flexDirection).toBe('column')
  expect(column?.text).toBe('? for shortcutsctx ▰▱▱▱ 34% | wk ▰▰▰▱ 86%        resets 2d')
  expect((await ui.find({ type: 'Text', text: /^▰▰▰▱ 86%$/ }))?.props.color).toBe('yellow')
})

test('fetches the model-scoped week with the session credential, at most once a minute', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  const clock = mock.clock(on, { now: NOW })
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{e.props.hint}</Text>
  })
  on('session.authorize', () => ({ value: { handle: 'h1', kind: 'bearer' as const } }))
  const fetches: { url: string; auth?: string }[] = []
  on('http.fetch', (_, e) => {
    fetches.push({ url: e.url, auth: e.init?.auth })
    const limits = [{ kind: 'weekly_scoped', percent: 28, resets_at: '2026-10-19T22:59:59Z', scope: { model: { display_name: 'Fable' } } }]
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ limits }) } }
  })
  const measure = () => $.session.measure({ context: { window: 200000, percent: 34 }, rateLimits: [], changed: ['context'] })

  await measure()
  await clock.advance(0)
  const mount = () => $.ui.mount({ plugin: 'usage-percent', surface: 'terminal', component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '?' } })
  expect((await (await mount()).find({ type: 'Box' }))?.text).toBe('?ctx ▰▱▱▱ 34% | fable ▰▱▱▱ 28%        resets 2d10h')
  expect(fetches).toEqual([{ url: 'https://api.anthropic.com/api/oauth/usage?skip_spend=1', auth: 'h1' }])

  await measure()
  await clock.advance(30_000)
  await measure()
  await clock.advance(0)
  expect(fetches.length).toBe(1)
  await clock.advance(30_000)
  await measure()
  await clock.advance(0)
  expect(fetches.length).toBe(2)
})

test('no figure without a first-party credential', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  const clock = mock.clock(on, { now: NOW })
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{e.props.hint}</Text>
  })
  on('session.authorize', () => ({ value: null }))
  let fetched = false
  on('http.fetch', () => {
    fetched = true
    return { value: { status: 200, ok: true, headers: {}, text: '{}' } }
  })
  await $.session.measure({ context: { window: 200000, percent: 34 }, rateLimits: [], changed: ['context'] })
  await clock.advance(0)
  const ui = await $.ui.mount({ plugin: 'usage-percent', surface: 'terminal', component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '?' } })
  expect((await ui.find({ type: 'Box' }))?.text).toBe('?ctx ▰▱▱▱ 34%')
  expect(fetched).toBe(false)
})

test('a push counts with -C or -c options before it', () => {
  expect(isGitPush('git push')).toBe(true)
  expect(isGitPush('cd x && git -C ../repo push -u origin HEAD')).toBe(true)
  expect(isGitPush('git -c core.sshCommand=ssh -C /r/repo push')).toBe(true)
  expect(isGitPush('git pushx')).toBe(false)
  expect(isGitPush('git log --grep push')).toBe(false)
})
