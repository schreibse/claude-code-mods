import { test, expect } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const ROW = { isRunning: false, isErrored: false, isInterrupted: false }

function engineToolRow(on: Parameters<TestBody>[1]) {
  on('env.get', () => ({ value: '/home/me' }) as never)
  on('ui.render', { component: 'ToolUse' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a failed Bash call is one line on ${surface}`, async ($, on) => {
    engineToolRow(on)
    const ui = await $.ui.mount({
      plugin: 'quiet-bash', surface, component: 'ToolUse',
      props: { ...ROW, tool_use_id: 't1', tool: 'Bash', input: { command: 'x', description: 'Run the tests' }, isErrored: true, output: 'Exit code 1\nFAIL' },
    })
    expect(await ui.find({ type: 'Text', text: 'Run the tests' })).toBeDefined()
    expect(await ui.find({ text: '  exit 1' })).toBeDefined()
    expect(await ui.find({ text: 'engine row' })).toBeUndefined()
  })

  test(`a finished Bash call leads with its status glyph on ${surface}`, async ($, on) => {
    engineToolRow(on)
    const ui = await $.ui.mount({
      plugin: 'quiet-bash', surface, component: 'ToolUse',
      props: { ...ROW, tool_use_id: 't4', tool: 'Bash', input: { command: 'x', description: 'Build admin' }, output: { stdout: '' } },
    })
    expect(await ui.find({ type: 'Text', text: '  ✓ ' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Build admin' })).toBeDefined()
    expect(await ui.find({ text: 'engine row' })).toBeUndefined()
  })

  test(`a finished Read draws nothing, a failed one stays on ${surface}`, async ($, on) => {
    engineToolRow(on)
    const props = { ...ROW, tool_use_id: 't5', tool: 'Read', input: { file_path: '/a/x.ts' }, output: { type: 'text' } }
    const quiet = await $.ui.mount({ plugin: 'quiet-bash', surface, component: 'ToolUse', props })
    expect(await quiet.find({ type: 'Text' })).toBeUndefined()
    const failed = await $.ui.mount({ plugin: 'quiet-bash', surface, component: 'ToolUse', props: { ...props, tool_use_id: 't6', isErrored: true, output: 'File does not exist.' } })
    expect(await failed.find({ type: 'Text', text: 'Read /a/x.ts' })).toBeDefined()
  })

  test(`a shot gets a header with its caption on ${surface}`, async ($, on) => {
    engineToolRow(on)
    on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'no magick' } }) as never)
    const ui = await $.ui.mount({
      plugin: 'quiet-bash', surface, component: 'ToolUse',
      props: { ...ROW, tool_use_id: 't2', tool: 'SendUserFile', input: { files: ['/a/before.png'], caption: 'before / after', status: 'normal' } },
    })
    expect(await ui.find({ type: 'Text', text: 'before / after' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '  1 image' })).toBeDefined()
  })

  test(`interactive tools stay the engine's on ${surface}`, async ($, on) => {
    engineToolRow(on)
    const ui = await $.ui.mount({
      plugin: 'quiet-bash', surface, component: 'ToolUse',
      props: { ...ROW, tool_use_id: 't3', tool: 'AskUserQuestion', input: {} },
    })
    expect(await ui.find({ text: 'engine row' })).toBeDefined()
  })
}

test('a pipeline-wait timeout row draws nothing, other failures stay', async ($, on) => {
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  const notify = (id: string, result: string) => $.prompt.submit({
    text: `<task-notification>\n<task-id>${id}</task-id>\n<status>failed</status>\n<summary>MCP task ${id} (gitlab/wait_for_pipeline) failed.</summary>\n<result>\nTask failed: ${result}\n</result>\n</task-notification>`,
    wait: false, origin: { kind: 'task-notification' },
  })
  await notify('k1', 'Timed out waiting for terminal status')
  await notify('k2', '404 Not Found')
  const props = { origin: { kind: 'task-notification' } as const, isExpanded: false, text: 'MCP task k1 (gitlab/wait_for_pipeline) failed', task: { id: 'k1', status: 'failed' } }
  const quiet = await $.ui.mount({ plugin: 'quiet-bash', surface: 'terminal', component: 'UserMessage', props })
  expect(await quiet.find({ text: 'engine row' })).toBeUndefined()
  const kept = await $.ui.mount({ plugin: 'quiet-bash', surface: 'terminal', component: 'UserMessage', props: { ...props, text: 'MCP task k2 (gitlab/wait_for_pipeline) failed', task: { id: 'k2', status: 'failed' } } })
  expect(await kept.find({ text: 'engine row' })).toBeDefined()
})

test('a group holding an image read unfolds, a plain read group stays hidden', async ($, on) => {
  on('ui.render', { component: 'ToolGroup' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.isExpanded ? 'unfolded' : 'folded'}</Text>
  })
  const call = { ...ROW, tool_use_id: 'g1', tool: 'Read', output: { type: 'image' } }
  const shot = await $.ui.mount({
    plugin: 'quiet-bash', surface: 'terminal', component: 'ToolGroup',
    props: { calls: [{ ...call, input: { file_path: '/a/shot.png' } }], isActive: false, isExpanded: false },
  })
  expect(await shot.find({ text: 'unfolded' })).toBeDefined()
  const plain = await $.ui.mount({
    plugin: 'quiet-bash', surface: 'terminal', component: 'ToolGroup',
    props: { calls: [{ ...call, tool_use_id: 'g2', input: { file_path: '/a/x.ts' }, output: { type: 'text' } }], isActive: false, isExpanded: false },
  })
  expect(await plain.find({ text: 'folded' })).toBeUndefined()
})

test('a written PNG named relative to a leading cd is looked up there', async ($, on) => {
  const statted: string[] = []
  on('env.get', () => ({ value: '/home/me' }) as never)
  on('session.cwd', () => ({ value: '/r' }) as never)
  on('clock.now', () => ({ value: 0 }) as never)
  on('fs.stat', (_$, e) => {
    statted.push(e.path)
    return { value: null } as never
  })
  on('tool.call', () => ({ isError: false, isReadOnly: false, result: { stdout: '' } }) as never)
  await $.tool.call({ tool: 'Bash', command: 'cd web && magick in.jpg out.png', description: 'Render' })
  expect(statted).toEqual(['/r/web/out.png'])
})

test('a sent PNG named relative to the session cwd is looked up there', async ($, on) => {
  const statted: string[] = []
  on('env.get', () => ({ value: '/home/me' }) as never)
  on('session.cwd', () => ({ value: '/r' }) as never)
  on('clock.now', () => ({ value: 0 }) as never)
  on('fs.stat', (_$, e) => {
    statted.push(e.path)
    return { value: null } as never
  })
  on('tool.call', () => ({ isError: false, isReadOnly: false, result: {} }) as never)
  await $.tool.call({ tool: 'SendUserFile', files: ['shot.png', '~/b.png'] } as never)
  expect(statted).toEqual(['/r/shot.png', '/home/me/b.png'])
})

test('a repeated /thumb keeps the earlier row on its own image', async ($, on) => {
  let mtimeMs = 1
  on('env.get', () => ({ value: '/home/me' }) as never)
  on('session.cwd', () => ({ value: '/r' }) as never)
  on('fs.stat', () => ({ value: { kind: 'file', mtimeMs, size: 1 } }) as never)
  on('process.run', () => ({ value: { exitCode: 0, stdout: '10 10 1', stderr: '', isStdoutTruncated: false } }) as never)
  const first = await $.command.run({ command: 'thumb', args: 'x.png' } as never)
  mtimeMs = 2
  const second = await $.command.run({ command: 'thumb', args: 'x.png' } as never)
  expect(first.text).not.toBe(second.text)
  const ui = await $.ui.mount({ plugin: 'quiet-bash', surface: 'terminal', component: 'CommandOutput', props: { command: 'thumb', args: 'x.png', text: first.text ?? '' } as never })
  const image = await ui.find({ type: 'Image' })
  expect((image as unknown as { props: { source: { generation: number } } }).props.source.generation).toBe(1)
})

test('/thumb draws an oversized PNG from a shrunk copy', async ($, on) => {
  on('env.get', () => ({ value: '/home/me' }) as never)
  on('session.cwd', () => ({ value: '/r' }) as never)
  on('fs.stat', () => ({ value: { kind: 'file', mtimeMs: 1, size: 1 } }) as never)
  on('process.run', (_, e) => {
    const stdout = (e as { argv: string[] }).argv.includes('identify') ? '2480 3507 1625182' : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX/AAAZ4gk3AAAACklEQVQI12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==\n'
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false } } as never
  })
  const { text } = await $.command.run({ command: 'thumb', args: '/a/big.png' } as never)
  const ui = await $.ui.mount({ plugin: 'quiet-bash', surface: 'terminal', component: 'CommandOutput', props: { command: 'thumb', args: '/a/big.png', text: text ?? '' } as never })
  const image = await ui.find({ type: 'Image' })
  expect((image as unknown as { props: { source: unknown } }).props.source).toEqual({ png: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX/AAAZ4gk3AAAACklEQVQI12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==' })
})
