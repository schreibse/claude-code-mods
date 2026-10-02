import { test, expect } from 'claude-code/testing'

const ROW = { isRunning: false, isErrored: false, isInterrupted: false }

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a failed Bash call is one line on ${surface}`, async ($, on) => {
    on('ui.render', { component: 'ToolUse' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })
    const ui = await $.ui.mount({
      plugin: 'quiet-bash', surface, component: 'ToolUse',
      props: { ...ROW, tool_use_id: 't1', tool: 'Bash', input: { command: 'x', description: 'Run the tests' }, isErrored: true, output: 'Exit code 1\nFAIL' },
    })
    expect(await ui.find({ type: 'Text', text: 'Run the tests' })).toBeDefined()
    expect(await ui.find({ text: '  exit 1' })).toBeDefined()
    expect(await ui.find({ text: 'engine row' })).toBeUndefined()
  })

  test(`a finished Bash call leads with its status glyph on ${surface}`, async ($, on) => {
    on('ui.render', { component: 'ToolUse' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })
    const ui = await $.ui.mount({
      plugin: 'quiet-bash', surface, component: 'ToolUse',
      props: { ...ROW, tool_use_id: 't4', tool: 'Bash', input: { command: 'x', description: 'Build admin' }, output: { stdout: '' } },
    })
    expect(await ui.find({ type: 'Text', text: '  ✓ ' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Build admin' })).toBeDefined()
    expect(await ui.find({ text: 'engine row' })).toBeUndefined()
  })

  test(`a finished Read draws nothing, a failed one stays on ${surface}`, async ($, on) => {
    on('ui.render', { component: 'ToolUse' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })
    const props = { ...ROW, tool_use_id: 't5', tool: 'Read', input: { file_path: '/a/x.ts' }, output: { type: 'text' } }
    const quiet = await $.ui.mount({ plugin: 'quiet-bash', surface, component: 'ToolUse', props })
    expect(await quiet.find({ type: 'Text' })).toBeUndefined()
    const failed = await $.ui.mount({ plugin: 'quiet-bash', surface, component: 'ToolUse', props: { ...props, tool_use_id: 't6', isErrored: true, output: 'File does not exist.' } })
    expect(await failed.find({ type: 'Text', text: 'Read /a/x.ts' })).toBeDefined()
  })

  test(`a shot gets a header with its caption on ${surface}`, async ($, on) => {
    on('ui.render', { component: 'ToolUse' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })
    on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'no magick' } }) as never)
    const ui = await $.ui.mount({
      plugin: 'quiet-bash', surface, component: 'ToolUse',
      props: { ...ROW, tool_use_id: 't2', tool: 'SendUserFile', input: { files: ['/a/before.png'], caption: 'before / after', status: 'normal' } },
    })
    expect(await ui.find({ type: 'Text', text: 'before / after' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '  1 image' })).toBeDefined()
  })

  test(`interactive tools stay the engine's on ${surface}`, async ($, on) => {
    on('ui.render', { component: 'ToolUse' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })
    const ui = await $.ui.mount({
      plugin: 'quiet-bash', surface, component: 'ToolUse',
      props: { ...ROW, tool_use_id: 't3', tool: 'AskUserQuestion', input: {} },
    })
    expect(await ui.find({ text: 'engine row' })).toBeDefined()
  })
}

test('a pipeline-wait timeout row draws nothing, other notifications stay', async ($, on) => {
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  const props = { origin: { kind: 'task-notification' } as const, isExpanded: false, text: 'MCP task kry26csj (gitlab/wait_for_pipeline) failed', task: { id: 'kry26csj', status: 'failed' } }
  const quiet = await $.ui.mount({ plugin: 'quiet-bash', surface: 'terminal', component: 'UserMessage', props })
  expect(await quiet.find({ text: 'engine row' })).toBeUndefined()
  const kept = await $.ui.mount({ plugin: 'quiet-bash', surface: 'terminal', component: 'UserMessage', props: { ...props, text: 'Agent "x" failed', task: { id: 'a1', status: 'failed' } } })
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
