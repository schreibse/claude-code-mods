import { test, expect, mock } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const band = ($: Parameters<TestBody>[0]) =>
  $.ui.mount({ plugin: 'task-meter', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false } as never })

function engine(on: Parameters<TestBody>[1]) {
  mock.clock(on)
  on('tool.call', (_, e) => {
    const call = e as { tool: string; run_in_background?: boolean }
    if (call.tool === 'Bash' && call.run_in_background) {
      return { isError: false, result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'bg1' } } as never
    }
    if (call.tool === 'Workflow') {
      return { isError: false, result: { status: 'async_launched', taskId: 'wf1', workflowName: 'review-changes' } } as never
    }
    return { isError: false, result: { stdout: '', stderr: '', interrupted: false } } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

test('background work gets a row until a notification or TaskStop ends it', async ($, on) => {
  engine(on)
  expect(await (await band($)).find({ type: 'Text', text: 'review-changes' })).toBeUndefined()

  await $.tool.call({ tool: 'Bash', command: 'pnpm exec jest --maxWorkers=2', description: 'Run the api tests', run_in_background: true })
  await $.tool.call({ tool: 'Workflow', script: 'export const meta = {}' })
  const shown = await band($)
  expect(await shown.find({ type: 'Text', text: /Run the api tests/ })).toBeDefined()
  expect(await shown.find({ type: 'Text', text: /review-changes/ })).toBeDefined()

  await $.tool.call({ tool: 'TaskStop', task_id: 'wf1' })
  const after = await band($)
  expect(await after.find({ type: 'Text', text: /review-changes/ })).toBeUndefined()
  expect(await after.find({ type: 'Text', text: /Run the api tests/ })).toBeDefined()
})

test('a finished foreground command leaves no row', async ($, on) => {
  engine(on)
  await $.tool.call({ tool: 'Bash', command: 'ls', description: 'List files' })
  expect(await (await band($)).find({ type: 'Text', text: /List files/ })).toBeUndefined()
})
