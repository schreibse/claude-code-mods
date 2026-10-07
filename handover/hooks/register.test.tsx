import { test, expect, mock } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const SENTENCE = 'PR #146 merged as 5fd98a4; next is #132 — read .claude/plans/132.md first.'

function home(on: Parameters<TestBody>[1]) {
  on('env.get', () => ({ value: '/home/me' }) as never)
  on('session.root', () => ({ value: '/r/repo' }) as never)
  on('tool.call', () => ({ isError: false, result: {} }) as never)
  on('classic.SessionStart', () => ({}) as never)
  const store = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: store.get((e as { key: string }).key) }) as never)
  on('store.set', (_, e) => {
    const { key, value } = e as { key: string; value: unknown }
    store.set(key, value)
    return { value: undefined } as never
  })
  on('store.delete', (_, e) => {
    store.delete((e as { key: string }).key)
    return { value: undefined } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return mock.clock(on, { now: 1_000 })
}

test('writing the handover file shows the band with its sentence', async ($, on) => {
  home(on)
  await $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: `${SENTENCE}\n` })
  const ui = await $.ui.mount({ plugin: 'handover', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false } as never })
  expect(await ui.find({ type: 'Text', text: SENTENCE })).toBeDefined()
})

test('other files leave the band away', async ($, on) => {
  home(on)
  await $.tool.call({ tool: 'Write', file_path: '/r/repo/handover.md', content: SENTENCE })
  const ui = await $.ui.mount({ plugin: 'handover', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false } as never })
  expect(await ui.find({ type: 'Text', text: SENTENCE })).toBeUndefined()
})

test('after /clear the sentence is proposed until a prompt is sent, which spends it', async ($, on) => {
  const clock = home(on)
  const suggested: string[] = []
  on('command.run', { command: 'clear' }, () => ({ text: '' }) as never)
  on('prompt.submit', (_, e) => ({ text: e.text }) as never)
  on('prompt.suggest', (_, e) => {
    suggested.push(e.text)
    return { isShown: true } as never
  })
  await $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: SENTENCE })
  await $.command.run({ command: 'clear', args: '' } as never)
  await clock.advance(1_000)
  expect(suggested).toEqual([SENTENCE, SENTENCE])
  await $.prompt.submit({ text: 'something else' } as never)
  await clock.advance(5_000)
  expect(suggested).toHaveLength(2)
  await $.command.run({ command: 'clear', args: '' } as never)
  await clock.advance(5_000)
  expect(suggested).toHaveLength(2)
})

test('a fresh process offers the sentence too, and a stale one not at all', async ($, on) => {
  const clock = home(on)
  const suggested: string[] = []
  on('prompt.suggest', (_, e) => {
    suggested.push(e.text)
    return { isShown: true } as never
  })
  await $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: SENTENCE })
  await $.classic.SessionStart({ source: 'startup' } as never)
  await clock.advance(500)
  expect(suggested).toEqual([SENTENCE])
  await clock.advance(60_000)
  expect(suggested).toHaveLength(20)
  await clock.advance(15 * 24 * 60 * 60 * 1000)
  await $.classic.SessionStart({ source: 'startup' } as never)
  await clock.advance(60_000)
  expect(suggested).toHaveLength(20)
})

test('/handover-copy copies the sentence and hides the band', async ($, on) => {
  home(on)
  const copied: string[] = []
  on('ui.copy', (_, e) => {
    copied.push((e as { text: string }).text)
    return { value: { isCopied: true } } as never
  })
  await $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: SENTENCE })
  const run = await $.command.run({ command: 'handover-copy', args: '' } as never)
  expect(run.text).toBe('Handover copied.')
  expect(copied).toEqual([SENTENCE])
  const ui = await $.ui.mount({ plugin: 'handover', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false } as never })
  expect(await ui.find({ type: 'Text', text: SENTENCE })).toBeUndefined()
})
