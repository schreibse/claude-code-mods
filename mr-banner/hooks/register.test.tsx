import { test, expect } from 'claude-code/testing'
import { cardFrom, kindOf, label } from './cards'

const MR = JSON.stringify({
  iid: 42,
  title: 'Portal: confirm link',
  web_url: 'https://gitlab.example.com/acme/shop/-/merge_requests/42',
  author: { web_url: 'https://gitlab.example.com/someone' },
})

test('GitLab MR writes and gh/glab commands map to a kind', () => {
  expect(kindOf('mcp__gitlab__create_merge_request', {})).toBe('created')
  expect(kindOf('mcp__gitlab__merge_merge_request', {})).toBe('merged')
  expect(kindOf('mcp__gitlab__create_merge_request_thread', {})).toBe(null)
  expect(kindOf('mcp__gitlab__get_merge_request', {})).toBe(null)
  expect(kindOf('Bash', { command: 'gh pr create --title x --body y' })).toBe('created')
  expect(kindOf('Bash', { command: 'cd repo && glab mr merge 12 --yes' })).toBe('merged')
  expect(kindOf('Bash', { command: 'gh pr review 4 --approve' })).toBe('approved')
  expect(kindOf('Bash', { command: 'gh pr review 4 --comment -b ok' })).toBe('reviewed')
  expect(kindOf('Bash', { command: 'gh pr view 4' })).toBe(null)
})

test('a created MR card carries ref, title and link', () => {
  const card = cardFrom('created', MR)
  expect(card).toEqual({
    kind: 'created',
    ref: '!42',
    url: 'https://gitlab.example.com/acme/shop/-/merge_requests/42',
    title: 'Portal: confirm link',
  })
  expect(label(card)).toBe('MR CREATED')
})

test('a gh pr create output becomes a PR card', () => {
  const card = cardFrom('created', 'Creating pull request\nhttps://github.com/octocat/hello/pull/3\n')
  expect(card.ref).toBe('#3')
  expect(label(card)).toBe('PR CREATED')
})

test('a card is drawn under the row beneath it, and only when the call is done', async ($, on) => {
  on('ui.render', { component: 'ToolUse' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  on('tool.call', () => ({ result: { content: [{ type: 'text', text: MR }] }, text: MR }))
  await $.tool.call({ tool: 'mcp__gitlab__create_merge_request', tool_use_id: 't1', project_id: 'acme/shop', title: 'x', source_branch: 'a', target_branch: 'b' } as never)

  const props = { tool_use_id: 't1', tool: 'mcp__gitlab__create_merge_request', input: {}, isRunning: false, isErrored: false, isInterrupted: false }
  const done = await $.ui.mount({ plugin: 'mr-banner', surface: 'terminal', component: 'ToolUse', props })
  expect(await done.find({ text: 'engine row' })).toBeDefined()
  expect(await done.find({ type: 'Link' })).toBeDefined()

  const running = await $.ui.mount({ plugin: 'mr-banner', surface: 'terminal', component: 'ToolUse', props: { ...props, isRunning: true } })
  expect(await running.find({ type: 'Link' })).toBeUndefined()
})

test('a gh pr merge without a URL still links the PR', () => {
  const card = cardFrom('merged', '✓ Squashed and merged pull request octocat/hello#3 (mr-banner)\n')
  expect(card.url).toBe('https://github.com/octocat/hello/pull/3')
  expect(label(card)).toBe('PR MERGED')
})
