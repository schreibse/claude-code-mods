import { expect, mock, test } from 'claude-code/testing'
import { isGitPush, line, resetIn } from './register'

const text = (pieces: readonly { text: string }[]) => pieces.map(p => p.text).join('')

const NOW = Date.parse('2026-10-17T12:00:00Z')

test('shows context and both limit windows as four-cell bars, coloured at 80% and 95%', () => {
  const pieces = line({ window: 200000, percent: 34 }, [
    { kind: 'five_hour', percentUsed: 41, resetsAt: '2026-10-17T15:03:00Z' },
    { kind: 'seven_day', percentUsed: 86, resetsAt: '2026-10-19T12:30:00Z' },
    { kind: 'spend_limit', percentUsed: 99 },
  ], NOW)
  expect(text(pieces)).toBe('ctx ▰▱▱▱ 34% | 5h ▰▰▱▱ 41% ⟳3h | wk ▰▰▰▱ 86% ⟳2d')
  expect(pieces.filter(p => p.tone !== 'dim').map(p => [p.text, p.tone])).toEqual([['▰▰▰▱ 86%', 'yellow']])
})

test('context alone before any rate-limit reading', () => {
  expect(text(line({ window: 200000 }, []))).toBe('ctx ▱▱▱▱ 0%')
})

test('a window at 95% or more turns red', () => {
  expect(line({ window: 200000, percent: 97 }, [])[1]).toEqual({ text: '▰▰▰▰ 97%', tone: 'red' })
})

test('the reset time rounds to days, hours or minutes and is left out once passed', () => {
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
    rateLimits: [{ kind: 'seven_day', percentUsed: 86 }],
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
  expect(column?.text).toBe('? for shortcutsctx ▰▱▱▱ 34% | wk ▰▰▰▱ 86%')
  expect((await ui.find({ type: 'Text', text: /^▰▰▰▱ 86%$/ }))?.props.color).toBe('yellow')
})

test('a push counts with -C or -c options before it', () => {
  expect(isGitPush('git push')).toBe(true)
  expect(isGitPush('cd x && git -C ../repo push -u origin HEAD')).toBe(true)
  expect(isGitPush('git -c core.sshCommand=ssh -C /r/repo push')).toBe(true)
  expect(isGitPush('git pushx')).toBe(false)
  expect(isGitPush('git log --grep push')).toBe(false)
})
