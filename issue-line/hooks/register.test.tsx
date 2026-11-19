import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import { focusIn, issueNumberOf, pickMr, projectPathOf, workdirIn } from './register'

const mr = (iid: string, sourceBranch: string, state = 'opened') => ({
  iid, sourceBranch, state, draft: false, webUrl: `https://gl/mr/${iid}`, resolvableDiscussionsCount: 5, resolvedDiscussionsCount: 3, headPipeline: { status: 'FAILED' },
})
const ISSUE = {
  iid: '2620', title: 'Rename the export button', state: 'opened', webUrl: 'https://gl/i/2620',
  relatedMergeRequests: { nodes: [mr('2794', '2620-register-groups'), mr('2767', '2849-other', 'merged'), mr('2723', '2620-ec-ai')] },
}

test('reads the issue number and the project path', () => {
  expect(issueNumberOf('2620-ec-ai')).toBe(2620)
  expect(issueNumberOf('main')).toBe(null)
  expect(projectPathOf('git@gitlab.example.com:group/project.git')).toBe('group/project')
  expect(projectPathOf('https://gitlab.example.com/group/project.git')).toBe('group/project')
})

test('takes the first issue or MR a prompt names', () => {
  expect(focusIn('implement #2620, see also #2446')).toEqual({ kind: 'issue', iid: 2620 })
  expect(focusIn('walk the threads on !2723 for #2620')).toEqual({ kind: 'mr', iid: 2723 })
  expect(focusIn('look at https://gitlab.example.com/a/b/-/merge_requests/2794')).toEqual({ kind: 'mr', iid: 2794 })
  expect(focusIn('look at https://gitlab.example.com/a/b/-/work_items/2620')).toEqual({ kind: 'issue', iid: 2620 })
  expect(focusIn('fix issue 2871 please')).toEqual({ kind: 'issue', iid: 2871 })
  expect(focusIn('color #fff and 3 items')).toBe(null)
})

test('picks the MR on the tab’s branch, else the only open one, else counts them', () => {
  const nodes = ISSUE.relatedMergeRequests.nodes
  expect(pickMr(nodes, 2620, '2620-ec-ai', null).mr?.iid).toBe('2723')
  expect(pickMr(nodes, 2620, 'main', null)).toEqual({ mr: null, openMrs: 2 })
  expect(pickMr([nodes[0]!, mr('2700', '2620-old', 'merged')], 2620, 'main', null).mr?.iid).toBe('2794')
})

// A found tree's text carries each Link's href before its label.
const withoutHrefs = (text: string) => text.replace(/https:\/\/gl\/\w+\/\d+/g, '')

type Scene = { transcript: { prompts: string[]; commands: string[] }; prompt?: string }

// The main repo sits on 2620-ec-ai; the worktree /wt/2331 on 2331-import.
async function mountTab($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], scene: Scene) {
  const clock = mock.clock(on, { now: 0 })
  on('command.register', () => ({ value: { command: 'issue-line' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.root', () => ({ value: '/repo' }))
  on('session.id', () => ({ value: 's1' }))
  const kept = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => { kept.set(e.key, e.value); return { value: undefined } })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('process.run', (_, e) => {
    const [cmd] = e.argv
    const query = e.argv.at(-1) ?? ''
    const issue = query.includes('"2331"') ? { ...ISSUE, iid: '2331', title: 'Import the member list', relatedMergeRequests: { nodes: [mr('2762', '2331-import')] } } : ISSUE
    const out =
      cmd === 'printenv' ? '/home/u'
      : cmd === 'python3' ? JSON.stringify(scene.transcript)
      : cmd === 'glab' ? JSON.stringify({ data: { project: { issue } } })
      : e.argv.includes('--show-current') ? (e.init?.cwd === '/wt/2331' ? '2331-import' : '2620-ec-ai')
      : 'git@host:group/project.git'
    return { value: { exitCode: 0, stdout: out, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{e.props.hint}</Text>
  })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  if (scene.prompt !== undefined) {
    await $.prompt.submit({ text: scene.prompt } as Parameters<typeof $.prompt.submit>[0])
  }
  await clock.advance(0)
  const ui = await $.ui.mount({ plugin: 'issue-line', surface: 'terminal', component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '?' } })
  return { text: withoutHrefs((await ui.find({ type: 'Box' }))?.text ?? ''), kept }
}

test('a tab told about #2620 shows the issue and its MR on the branch', async ($, on) => {
  const { text, kept } = await mountTab($, on, { transcript: { prompts: [], commands: [] }, prompt: 'implement #2620 slice H' })
  expect(text).toContain('issue #2620 ')
  expect(text).toContain('!2723')
  expect(kept.get('focus-by-session')).toEqual({ s1: { focus: { kind: 'issue', iid: 2620, source: 'prompt' }, workdir: null, at: 0 } })
})

test('a resumed tab that worked in a worktree shows that worktree’s issue, not the main repo’s', async ($, on) => {
  const { text } = await mountTab($, on, { transcript: { prompts: ['ci is red no?'], commands: ['git status', 'cd /wt/2331 && git diff'] } })
  expect(text).toContain('issue #2331 ')
  expect(text).toContain('!2762')
})

test('a resumed tab takes the first issue its earlier prompts named', async ($, on) => {
  const { text } = await mountTab($, on, { transcript: { prompts: ['whats next on https://gl/a/-/work_items/2331', 'see #2620'], commands: [] } })
  expect(text).toContain('issue #2331 ')
})

test('follows the folder a shell command works in', () => {
  expect(workdirIn('cd /home/u/repos/ec-platform-2331 && git diff', '/home/u')).toBe('/home/u/repos/ec-platform-2331')
  expect(workdirIn('cd "/home/u/a b"; ls', '/home/u')).toBe('/home/u/a b')
  expect(workdirIn('git -C ~/repos/x-2331/ log', '/home/u')).toBe('/home/u/repos/x-2331')
  expect(workdirIn('cd apps && ls', '/home/u')).toBe(null)
  expect(workdirIn('pnpm nx test', '/home/u')).toBe(null)
})

test('leaves the MR number out when the hint line already names it, keeping the thread count', async ($, on) => {
  on('command.register', () => ({ value: { command: 'issue-line' } }))
  const clock = mock.clock(on, { now: 0 })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.root', () => ({ value: '/repo' }))
  on('session.id', () => ({ value: 's1' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('process.run', (_, e) => {
    const [cmd] = e.argv
    const out = cmd === 'printenv' ? '/home/u' : cmd === 'python3' ? '{"prompts":[],"commands":[]}' : cmd === 'glab' ? JSON.stringify({ data: { project: { issue: ISSUE } } }) : e.argv.includes('--show-current') ? '2620-ec-ai' : 'git@host:group/project.git'
    return { value: { exitCode: 0, stdout: out, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{e.props.hint}</Text>
  })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await clock.advance(0)
  const ui = await $.ui.mount({ plugin: 'issue-line', surface: 'terminal', component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: 'auto mode on · MR !2723 · esc to interrupt' } })
  const text = withoutHrefs((await ui.find({ type: 'Box' }))?.text ?? '')
  expect(text.match(/!2723/g)?.length).toBe(1)
  expect(text).toContain('ci ✗ · threads 💬 2')
})
