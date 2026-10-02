import { test, expect } from 'claude-code/testing'
import { line } from './register'

test('shows context and both limit windows, marking 80% and 95%', () => {
  const text = line({ window: 200000, percent: 34 }, [
    { kind: 'five_hour', percentUsed: 41 },
    { kind: 'seven_day', percentUsed: 86 },
    { kind: 'spend_limit', percentUsed: 99 },
  ])
  expect(text).toBe('ctx 34% | 5h 41% | wk 86%▲')
})

test('context alone before any rate-limit reading', () => {
  expect(line({ window: 200000 }, [])).toBe('ctx 0%')
})

test('marks a window at 95% or more', () => {
  expect(line({ window: 200000, percent: 97 }, [])).toBe('ctx 97%✖')
})

test('draws the usage in its own row under the hint line', async ($, on) => {
  on('session.measure', ($, e) => ({ changed: e.changed }))
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
  expect(column?.text).toBe('? for shortcutsctx 34% | wk 86%▲')
})
