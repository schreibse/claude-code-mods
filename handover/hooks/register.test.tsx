import { test, expect, mock } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const WORK = 'PR #146 merged as 5fd98a4; next is #132 — read .claude/plans/132.md first.'
const ANALYZE = 'Analysis of #140 done; next is the write-up — read .claude/plans/140.md first.'
const DAY = 24 * 60 * 60 * 1000

function home(on: Parameters<TestBody>[1]) {
  const session = { id: 's1' }
  const writes: string[] = []
  const removed: string[] = []
  const suggested: string[] = []
  on('env.get', () => ({ value: '/home/me' }) as never)
  on('session.root', () => ({ value: '/r/repo' }) as never)
  on('session.id', () => ({ value: session.id }) as never)
  on('tool.call', (_, e) => {
    writes.push((e as { file_path: string }).file_path)
    return { isError: false, result: {} } as never
  })
  on('classic.SessionStart', () => ({}) as never)
  on('prompt.submit', (_, e) => ({ text: e.text }) as never)
  on('prompt.suggest', (_, e) => {
    suggested.push(e.text)
    return { isShown: true } as never
  })
  on('process.run', (_, e) => {
    removed.push((e as { argv: string[] }).argv.at(-1) ?? '')
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  const store = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: store.get((e as { key: string }).key) }) as never)
  on('store.keys', () => ({ value: [...store.keys()] }) as never)
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
  return { clock: mock.clock(on, { now: 1_000 }), session, writes, removed, suggested, store }
}

const band = ($: Parameters<TestBody>[0]) =>
  $.ui.mount({ plugin: 'handover', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false } as never })

test('the sentence goes to a file of the session\'s own and shows in the band', async ($, on) => {
  const { writes } = home(on)
  await $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: `${WORK}\n` })
  expect(writes).toEqual(['/home/me/.claude/handovers/s1.md'])
  expect(await (await band($)).find({ type: 'Text', text: WORK })).toBeDefined()
})

test('other files pass untouched and leave the band away', async ($, on) => {
  const { writes } = home(on)
  await $.tool.call({ tool: 'Write', file_path: '/r/repo/handover.md', content: WORK })
  expect(writes).toEqual(['/r/repo/handover.md'])
  expect(await (await band($)).find({ type: 'Text', text: WORK })).toBeUndefined()
})

test('two sessions in one repo keep a sentence each', async ($, on) => {
  const { session, store } = home(on)
  await $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: WORK })
  session.id = 's2'
  await $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: ANALYZE })
  expect([...store.keys()]).toEqual(['handover:s1', 'handover:s2'])
})

test('after /clear the session\'s own sentence is proposed, and the first prompt spends it', async ($, on) => {
  const { clock, session, removed, suggested, store } = home(on)
  on('command.run', { command: 'clear' }, () => {
    session.id = 's3'
    return { text: '' } as never
  })
  store.set('handover:s2', { text: ANALYZE, at: 1_000, root: '/r/repo' })
  await $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: WORK })
  await $.command.run({ command: 'clear', args: '' } as never)
  await clock.advance(1_000)
  expect(suggested).toEqual([WORK, WORK])
  await $.prompt.submit({ text: 'something else' } as never)
  await clock.advance(5_000)
  expect(suggested).toHaveLength(2)
  expect(removed).toEqual(['/home/me/.claude/handovers/s1.md'])
  expect([...store.keys()]).toEqual(['handover:s2'])
})

test('a fresh process proposes nothing but lists the repo\'s sentences, newest first', async ($, on) => {
  const { clock, removed, suggested, store } = home(on)
  store.set('handover:old', { text: 'old', at: 1_000 - 15 * DAY, root: '/r/repo' })
  store.set('handover:s1', { text: WORK, at: 500, root: '/r/repo' })
  store.set('handover:s2', { text: ANALYZE, at: 900, root: '/r/repo' })
  store.set('handover:s9', { text: 'elsewhere', at: 900, root: '/r/other' })
  await $.classic.SessionStart({ source: 'startup' } as never)
  await clock.advance(5_000)
  expect(suggested).toEqual([])
  expect(removed).toEqual(['/home/me/.claude/handovers/old.md'])
  const ui = await band($)
  expect(await ui.find({ type: 'Text', text: `1. ${ANALYZE}` })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: `2. ${WORK}` })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '3. elsewhere' })).toBeUndefined()
})

test('/handover lists, /handover N proposes that one and the next prompt spends it', async ($, on) => {
  const { clock, removed, suggested, store } = home(on)
  store.set('handover:s1', { text: WORK, at: 500, root: '/r/repo' })
  store.set('handover:s2', { text: ANALYZE, at: 900, root: '/r/repo' })
  expect((await $.command.run({ command: 'handover', args: '' } as never)).text).toBe(`1. ${ANALYZE}\n\n2. ${WORK}`)
  expect((await $.command.run({ command: 'handover', args: '2' } as never)).text).toBe('Handover 2 waits in the prompt; Tab takes it.')
  await clock.advance(500)
  expect(suggested).toEqual([WORK])
  await $.prompt.submit({ text: WORK } as never)
  expect(removed).toEqual(['/home/me/.claude/handovers/s1.md'])
  expect([...store.keys()]).toEqual(['handover:s2'])
})

test('/handover-copy copies the sentence and hides the band', async ($, on) => {
  home(on)
  const copied: string[] = []
  on('ui.copy', (_, e) => {
    copied.push((e as { text: string }).text)
    return { value: { isCopied: true } } as never
  })
  await $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: WORK })
  const run = await $.command.run({ command: 'handover-copy', args: '' } as never)
  expect(run.text).toBe('Handover copied.')
  expect(copied).toEqual([WORK])
  expect(await (await band($)).find({ type: 'Text', text: WORK })).toBeUndefined()
})

test('a literal ~ path still files the sentence per session', async ($, on) => {
  const { writes } = home(on)
  await $.tool.call({ tool: 'Write', file_path: '~/.claude/handover.md', content: WORK })
  expect(writes).toEqual(['/home/me/.claude/handovers/s1.md'])
})

test('/handover N picks from the list shown, though another session wrote since', async ($, on) => {
  const { clock, suggested, store } = home(on)
  store.set('handover:s1', { text: WORK, at: 500, root: '/r/repo' })
  await $.classic.SessionStart({ source: 'startup' } as never)
  store.set('handover:s2', { text: ANALYZE, at: 900, root: '/r/repo' })
  await $.command.run({ command: 'handover', args: '1' } as never)
  await clock.advance(500)
  expect(suggested).toEqual([WORK])
  expect((await $.command.run({ command: 'handover', args: '' } as never)).text).toBe(`1. ${ANALYZE}\n\n2. ${WORK}`)
})

test('a sentence pasted by hand is spent, in any repo', async ($, on) => {
  const { removed, store } = home(on)
  store.set('handover:s1', { text: WORK, at: 500, root: '/r/repo' })
  store.set('handover:s2', { text: ANALYZE, at: 900, root: '/r/other' })
  await $.prompt.submit({ text: `continue:\n${ANALYZE}` } as never)
  expect(removed).toEqual(['/home/me/.claude/handovers/s2.md'])
  expect([...store.keys()]).toEqual(['handover:s1'])
})

test('/handover drop N removes that entry and renumbers the band', async ($, on) => {
  const { removed, store } = home(on)
  store.set('handover:s1', { text: WORK, at: 500, root: '/r/repo' })
  store.set('handover:s2', { text: ANALYZE, at: 900, root: '/r/repo' })
  await $.classic.SessionStart({ source: 'startup' } as never)
  expect((await $.command.run({ command: 'handover', args: 'drop 1' } as never)).text).toBe('Handover 1 dropped.')
  expect(removed).toEqual(['/home/me/.claude/handovers/s2.md'])
  expect([...store.keys()]).toEqual(['handover:s1'])
  const ui = await band($)
  expect(await ui.find({ type: 'Text', text: `1. ${WORK}` })).toBeDefined()
  expect((await $.command.run({ command: 'handover', args: 'drop 1' } as never)).text).toBe('Handover 1 dropped.')
  expect(await (await band($)).find({ type: 'Text', text: `1. ${WORK}` })).toBeUndefined()
  expect((await $.command.run({ command: 'handover', args: 'drop 1' } as never)).text).toBe('No handover for this repo.')
})
