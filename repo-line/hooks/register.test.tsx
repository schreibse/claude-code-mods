import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const START = { cwd: '/home/me/dev/khipu', surface: 'terminal', isInteractive: true } as const
const BAND = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100 } as never
const RUN = { isStdoutTruncated: false, isStderrTruncated: false }
const COMMAND = { command: 'repo-line', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 100 } }

type Drawn = { type: string; part?: { plugin: string }; children?: Drawn[] }
// The kit draws a test's own render hook beside the plugin, not beneath it, so order is read from the plugin's part.
const partOf = (root: unknown, plugin: string) => (root as Drawn | undefined)?.children?.find(c => c.part?.plugin === plugin)

function gitAnswers(on: On, answers: { dirs: string; branch: string; head: string }) {
  on('process.run', (_, e) => {
    const args = e.argv.slice(1).join(' ')
    const stdout = args.startsWith('rev-parse --path-format') ? answers.dirs : args.startsWith('branch') ? answers.branch : answers.head
    return { value: { ...RUN, exitCode: 0, stdout, stderr: '' } }
  })
}

test('draws the repository badge, the branch and the worktree under the other bands', async ($, on) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/home/me/dev/khipu-review' }))
  on('command.register', () => ({ value: { command: 'repo-line' } }))
  mock.clock(on, { now: 0 })
  mock.store(on, {})
  gitAnswers(on, { dirs: '/home/me/dev/khipu/.git\n/home/me/dev/khipu-review', branch: 'fix/review', head: 'abc1234' })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>the band above</Text>
  })
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'repo-line', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const root = await ui.find({ type: 'Box' })
  expect(root?.text).toContain(' khipu  ⎇ fix/review (wt: khipu-review)')
  expect(partOf(root, 'repo-line')?.children?.[0]).toMatchObject({ type: 'engine' })
  expect(await ui.keepsBeneath()).toBe(true)
  expect(await ui.find({ type: 'Text', text: 'the band above' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^ khipu $/ }))?.props.backgroundColor).toBe('#57afdb')
  await ui.unmount()
})

test('each new repository gets the next hue, kept across sessions; an override wins until reset', async ($, on) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/home/me/dev/retreats' }))
  on('command.register', () => ({ value: { command: 'repo-line' } }))
  mock.clock(on, { now: 0 })
  mock.store(on, { hues: { khipu: 200 } })
  gitAnswers(on, { dirs: '/home/me/dev/retreats/.git\n/home/me/dev/retreats', branch: '', head: 'abc1234' })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  await $.session.start(START)
  const mount = () => $.ui.mount({ plugin: 'repo-line', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  let ui = await mount()
  expect((await ui.find({ type: 'Box' }))?.text).toBe(' retreats  ⎇ @abc1234')
  expect((await ui.find({ type: 'Text', text: /retreats/ }))?.props.backgroundColor).toBe('#db5788')
  await ui.unmount()

  expect(await $.command.run({ ...COMMAND, args: 'color #ff8800' })).toEqual({ text: 'retreats is now #ff8800.' })
  ui = await mount()
  expect((await ui.find({ type: 'Text', text: /retreats/ }))?.props.backgroundColor).toBe('#ff8800')
  await ui.unmount()
  expect(await $.command.run({ ...COMMAND, args: 'color purple' })).toEqual({ text: 'Not a colour: purple. A hue 0-359 or #rrggbb.' })
  expect(await $.command.run({ ...COMMAND, args: 'color reset' })).toEqual({ text: 'retreats is now #db5788.' })
})

test('outside a repository the band is left as it is', async ($, on) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/tmp' }))
  on('command.register', () => ({ value: { command: 'repo-line' } }))
  mock.clock(on, { now: 0 })
  mock.store(on, {})
  on('process.run', () => ({ value: { ...RUN, exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' } }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>only the band above</Text>
  })
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'repo-line', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('only the band above')
  await ui.unmount()
})
