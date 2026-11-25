import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import { ciOf, focusIn, issueNumberOf, pickMr, projectPathOf, shorten, workdirIn } from './register'

const mr = (iid: string, sourceBranch: string, state = 'opened', createdAt = `2026-01-01T00:00:${iid.slice(-2)}Z`) => ({
  iid, title: `MR ${iid}`, sourceBranch, state, createdAt, draft: false, webUrl: `https://gl/mr/${iid}`, resolvableDiscussionsCount: 5, resolvedDiscussionsCount: 3, headPipeline: { status: 'FAILED' },
})
const ISSUE = {
  iid: '2620', title: 'Rename the export button', state: 'opened', webUrl: 'https://gl/i/2620',
  relatedMergeRequests: { nodes: [mr('2794', '2620-register-groups'), mr('2767', '2849-other', 'merged'), mr('2723', '2620-ec-ai')] },
}
const OTHER_ISSUE = { ...ISSUE, iid: '2331', title: 'Import the member list', webUrl: 'https://gl/i/2331', relatedMergeRequests: { nodes: [mr('2762', '2331-import')] } }

test('reads the issue number and the project path, and no path for GitHub', () => {
  expect(issueNumberOf('2620-ec-ai')).toBe(2620)
  expect(issueNumberOf('main')).toBe(null)
  expect(projectPathOf('git@gitlab.example.com:group/project.git')).toBe('group/project')
  expect(projectPathOf('https://gitlab.example.com/group/project.git')).toBe('group/project')
  expect(projectPathOf('git@github.com:owner/repo.git')).toBe(null)
  expect(projectPathOf('https://github.com/owner/repo')).toBe(null)
})

test('takes the first issue or MR a prompt names, with a link’s project', () => {
  expect(focusIn('implement #2620, see also #2446')).toEqual({ kind: 'issue', iid: 2620, host: null, project: null })
  expect(focusIn('walk the threads on !2723 for #2620')).toEqual({ kind: 'mr', iid: 2723, host: null, project: null })
  expect(focusIn('look at https://gitlab.example.com/a/b/-/merge_requests/2794')).toEqual({ kind: 'mr', iid: 2794, host: 'gitlab.example.com', project: 'a/b' })
  expect(focusIn('look at https://gitlab.example.com/group/other/-/work_items/42')).toEqual({ kind: 'issue', iid: 42, host: 'gitlab.example.com', project: 'group/other' })
  expect(focusIn('fix issue 2871 please')).toEqual({ kind: 'issue', iid: 2871, host: null, project: null })
})

test('a bare #NN is an issue only at the start or after an issue word', () => {
  expect(focusIn('color #fff and 3 items')).toBe(null)
  expect(focusIn('make it color: #333')).toBe(null)
  expect(focusIn('border: 1px solid #333;')).toBe(null)
  expect(focusIn('the header is #123456 now')).toBe(null)
  expect(focusIn('the bug is on line #42')).toBe(null)
  expect(focusIn('like GitHub #12 does')).toBe(null)
  expect(focusIn('see PR #12')).toBe(null)
  expect(focusIn('use #333 instead')).toBe(null)
  expect(focusIn('grey (#999)')).toBe(null)
  expect(focusIn('white text on #333')).toBe(null)
  expect(focusIn('same border for #444 too')).toBe(null)
  expect(focusIn('about #555')).toBe(null)
  expect(focusIn(`grey\n${' '.repeat(30)}#333`)).toBe(null)
  expect(focusIn('#333 is too dark')).toBe(null)
  expect(focusIn('about #2331')).toEqual({ kind: 'issue', iid: 2331, host: null, project: null })
  expect(focusIn('see #333')).toEqual({ kind: 'issue', iid: 333, host: null, project: null })
  expect(focusIn('  (#2620) first')).toEqual({ kind: 'issue', iid: 2620, host: null, project: null })
  expect(focusIn('Issue: #2620')).toEqual({ kind: 'issue', iid: 2620, host: null, project: null })
  expect(focusIn('issue number #2620')).toEqual({ kind: 'issue', iid: 2620, host: null, project: null })
  expect(focusIn('#2620 slice H')).toEqual({ kind: 'issue', iid: 2620, host: null, project: null })
  expect(focusIn('line #42 breaks, see #2620')).toEqual({ kind: 'issue', iid: 2620, host: null, project: null })
})

test('picks the MR on the session’s branch, else the only open one, else counts them', () => {
  const nodes = ISSUE.relatedMergeRequests.nodes
  expect(pickMr(nodes, 2620, '2620-ec-ai').mr?.iid).toBe('2723')
  expect(pickMr(nodes, 2620, 'main')).toEqual({ mr: null, openMrs: 2 })
  const older = mr('2700', '2620-old', 'merged', '2026-01-01T00:00:00Z')
  const newer = mr('2701', '2620-new', 'merged', '2026-03-01T00:00:00Z')
  expect(pickMr([older, newer], 2620, 'main').mr?.iid).toBe('2701')
  expect(pickMr([newer, older], 2620, 'main').mr?.iid).toBe('2701')
  expect(pickMr([nodes[0]!, mr('2700', '2620-old', 'merged')], 2620, 'main').mr?.iid).toBe('2794')
})

test('with no MR on an `<iid>-…` branch, takes the only open linked one', () => {
  expect(pickMr([mr('2800', 'fix-login'), mr('2801', 'old-try', 'closed')], 2620, 'main').mr?.iid).toBe('2800')
  expect(pickMr([mr('2800', 'fix-login'), mr('2802', 'other')], 2620, 'main')).toEqual({ mr: null, openMrs: 2 })
})

test('follows the last absolute folder a shell command works in', () => {
  expect(workdirIn('cd /home/u/repos/ec-platform-2331 && git diff', '/home/u')).toBe('/home/u/repos/ec-platform-2331')
  expect(workdirIn('cd "/home/u/a b"; ls', '/home/u')).toBe('/home/u/a b')
  expect(workdirIn('git -C ~/repos/x-2331/ log', '/home/u')).toBe('/home/u/repos/x-2331')
  expect(workdirIn('npm test && cd /x/y', '/home/u')).toBe('/x/y')
  expect(workdirIn('(cd /a && make) ; cd $HOME/b', '/home/u')).toBe('/home/u/b')
  expect(workdirIn('cd ~', '/home/u')).toBe('/home/u')
  expect(workdirIn('echo x\ncd /wt/2331', '/home/u')).toBe('/wt/2331')
  expect(workdirIn('cd /a && cd apps', '/home/u')).toBe('/a')
  expect(workdirIn('cd apps && ls', '/home/u')).toBe(null)
  expect(workdirIn('pnpm nx test', '/home/u')).toBe(null)
})

test('the CI glyphs follow usage-percent’s', () => {
  expect(ciOf('CANCELED')).toEqual({ glyph: '✗', tone: 'red' })
  expect(ciOf('SKIPPED')).toBe(null)
  expect(ciOf('RUNNING')).toEqual({ glyph: '⏳', tone: 'dim' })
})

test('cuts a long title to 40 characters with no space before the ellipsis', () => {
  expect(shorten('Split the invoice export into one file per month')).toBe('Split the invoice export into one file…')
  expect(shorten('Retry failed mail delivery')).toBe('Retry failed mail delivery')
})

// A found tree's text carries each Link's href before its label.
const withoutHrefs = (text: string) => text.replace(/https:\/\/gl\/\w+\/\d+/g, '')

type Glab = (query: string) => { exitCode: number; project?: unknown } | Promise<{ exitCode: number; project?: unknown }>
type Transcript = { prompts: string[]; commands: string[] }
type Scene = { transcript?: Transcript | 'fails' | 'truncated' | (() => Promise<Transcript>); prompt?: string; hint?: string; glab?: Glab; id?: () => string; kept?: [string, unknown][]; storeSet?: () => Promise<void> }

// Project group/project knows issues 2620 and 2331 and MR 2723; the main repo sits on 2620-ec-ai, the worktree /wt/2331 on 2331-import.
const GLAB: Glab = query => {
  if (!query.includes('"group/project"')) {
    return { exitCode: 0, project: query.includes('"group/other"') && query.includes('"42"') ? { issue: { ...OTHER_ISSUE, iid: '42', title: 'Other project issue' } } : { issue: null } }
  }
  if (query.includes('mergeRequest(iid: "2723")')) {
    return { exitCode: 0, project: { mergeRequest: mr('2723', '2620-ec-ai') } }
  }
  const issue = query.includes('"2620"') ? ISSUE : query.includes('"2331"') ? OTHER_ISSUE : null
  return { exitCode: 0, project: { issue, mergeRequest: null } }
}

async function mountSession($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], scene: Scene) {
  const clock = mock.clock(on, { now: 0 })
  on('command.register', () => ({ value: { command: 'issue-line' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.root', () => ({ value: '/repo' }))
  on('session.id', () => ({ value: scene.id?.() ?? 's1' }))
  const kept = new Map<string, unknown>(scene.kept)
  on('store.keys', () => ({ value: [...kept.keys()] }))
  on('store.delete', (_, e) => { kept.delete(e.key); return { value: undefined } })
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', async (_, e) => { await scene.storeSet?.(); kept.set(e.key, e.value); return { value: undefined } })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }) as never)
  on('tool.call', () => ({ isError: false, result: { stdout: '', stderr: '', interrupted: false } }) as never)
  const queries: string[] = []
  on('process.run', async (_, e) => {
    const [cmd] = e.argv
    const query = e.argv.at(-1) ?? ''
    if (cmd === 'python3' && scene.transcript === 'fails') {
      throw new Error('spawn python3 ENOENT')
    }
    const glab = cmd === 'glab' ? await (scene.glab ?? GLAB)(query) : null
    if (glab !== null) {
      queries.push(e.argv.join(' '))
    }
    const out =
      cmd === 'printenv' ? '/home/u'
      : cmd === 'python3' && scene.transcript === 'truncated' ? '{"prompts": ["implement #23'
      : cmd === 'python3' ? JSON.stringify(typeof scene.transcript === 'function' ? await scene.transcript() : (scene.transcript ?? { prompts: [], commands: [] }))
      : glab !== null ? JSON.stringify({ data: { project: glab.project } })
      : e.argv.includes('--show-current') ? (e.init?.cwd === '/wt/2331' ? '2331-import' : '2620-ec-ai')
      : 'git@host:group/project.git'
    return { value: { exitCode: glab?.exitCode ?? 0, stdout: out, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
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
  const rawText = async () => {
    const ui = await $.ui.mount({ plugin: 'issue-line', surface: 'terminal', component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: scene.hint ?? '?' } })
    return (await ui.find({ type: 'Box' }))?.text ?? ''
  }
  const text = async () => withoutHrefs(await rawText())
  const command = async (args: string) => {
    const result = await $.command.run({ command: 'issue-line', args } as Parameters<typeof $.command.run>[0])
    await clock.advance(0)
    return result
  }
  const bash = async (command: string, agentId?: string) => {
    const call: (input: object) => Promise<unknown> = $.tool.call as never
    await call({ tool: 'Bash', command, description: 'run', agentId })
    await clock.advance(0)
  }
  return { text, rawText, kept, queries, command, clock, bash }
}

test('a session told about #2620 shows the issue and its MR on the branch', async ($, on) => {
  const { text, kept } = await mountSession($, on, { prompt: 'implement #2620 slice H' })
  expect(await text()).toContain('issue #2620 ')
  expect(await text()).toContain('!2723')
  expect(kept.get('session:s1')).toEqual({ focus: { kind: 'issue', iid: 2620, host: null, project: null, source: 'prompt' }, workdir: null, at: 0 })
})

test('a resumed session that worked in a worktree shows that worktree’s issue, not the main repo’s', async ($, on) => {
  const { text } = await mountSession($, on, { transcript: { prompts: ['ci is red no?'], commands: ['git status', 'cd /wt/2331 && git diff'] } })
  expect(await text()).toContain('issue #2331 ')
  expect(await text()).toContain('!2762')
})

test('a resumed session takes the first issue its earlier prompts named', async ($, on) => {
  const { text } = await mountSession($, on, { transcript: { prompts: ['whats next on #2331', 'see #2620'], commands: [] } })
  expect(await text()).toContain('issue #2331 ')
})

test('a link to another project looks up that project’s issue', async ($, on) => {
  const { text, queries } = await mountSession($, on, { prompt: 'compare with https://gitlab.example.com/group/other/-/issues/42' })
  expect(await text()).toContain('issue #42 Other project issue')
  expect(queries.at(-1)).toContain('fullPath: "group/other"')
  expect(queries.at(-1)).toContain('--hostname gitlab.example.com')
})

test('an MR in the prompt shows its issue and that MR', async ($, on) => {
  const { text, queries } = await mountSession($, on, { prompt: 'walk the threads on !2723' })
  expect(queries.some(q => q.includes('mergeRequest(iid: "2723")'))).toBe(true)
  expect(await text()).toContain('issue #2620 ')
  expect(await text()).toContain('!2723')
})

test('`/issue-line 5` pins a one-digit issue; one that does not exist clears the line and says so', async ($, on) => {
  const { text, command, kept } = await mountSession($, on, { prompt: 'implement #2620' })
  expect(await text()).toContain('issue #2620 ')
  expect(await command('5')).toEqual({ text: 'Nothing found for #5.' })
  expect(await text()).not.toContain('issue')
  expect((kept.get('session:s1') as { focus: unknown }).focus).toEqual({ kind: 'issue', iid: 5, host: null, project: null, source: 'pin' })
})

test('`/issue-line 2331` pins, `/issue-line auto` goes back to the branch', async ($, on) => {
  const { text, command } = await mountSession($, on, { prompt: 'implement #2620' })
  expect(await command('2331')).toEqual({ text: '#2331 Import the member list (pinned)' })
  expect(await text()).toContain('issue #2331 ')
  expect(await command('auto')).toEqual({ text: '#2620 Rename the export button (from the branch in /repo)' })
  expect(await text()).toContain('issue #2620 ')
})

test('a failing glab keeps the line and the command says so; a new focus clears it', async ($, on) => {
  let isDown = false
  const { text, command } = await mountSession($, on, { prompt: 'implement #2620', glab: q => (isDown ? { exitCode: 1 } : GLAB(q)) })
  isDown = true
  expect((await command('')).text).toContain('The GitLab lookup failed')
  expect(await text()).toContain('issue #2620 ')
  await command('2331')
  expect(await text()).not.toContain('#2620')
})

test('an older, slower lookup does not overwrite a newer one', async ($, on) => {
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  let isSlow = false
  const { text, command, clock } = await mountSession($, on, { glab: async q => (isSlow && q.includes('"2620"') ? (await gate, GLAB(q)) : GLAB(q)) })
  isSlow = true
  await clock.advance(2 * 60_000)
  expect(await command('2331')).toEqual({ text: '#2331 Import the member list (pinned)' })
  release()
  await clock.advance(0)
  expect(await text()).toContain('issue #2331 ')
})

test('leaves only the MR number out when the hint line already names it, keeping state, ci and threads', async ($, on) => {
  const draft = { ...ISSUE, relatedMergeRequests: { nodes: [{ ...mr('2723', '2620-ec-ai'), draft: true }] } }
  const { text } = await mountSession($, on, { hint: 'auto mode on · MR !2723 · esc to interrupt', glab: () => ({ exitCode: 0, project: { issue: draft } }) })
  const line = await text()
  expect(line.match(/!2723/g)?.length).toBe(1)
  expect(line).toContain('· mr draft · ci ✗ · threads 💬 2')
})

test('a terminal without OSC 8 links prints the issue URL once', async ($, on) => {
  const { rawText } = await mountSession($, on, { prompt: 'implement #2620' })
  expect((await rawText()).split('https://gl/i/2620').length - 1).toBe(1)
})

test('an MR with no issue shows the MR and its title once', async ($, on) => {
  const { text } = await mountSession($, on, { prompt: 'look at !2723', glab: q => (q.includes('mergeRequest') ? { exitCode: 0, project: { mergeRequest: mr('2723', 'fix-login') } } : { exitCode: 0, project: { issue: null } }) })
  const line = await text()
  expect(line).toContain('mr !2723 MR 2723 · ci ✗')
  expect(line).not.toContain('issue')
})

test('a transcript scan that cannot run leaves the branch’s issue', async ($, on) => {
  const { text } = await mountSession($, on, { transcript: 'fails' })
  expect(await text()).toContain('issue #2620 ')
})

test('a cut-off transcript scan after /clear does not keep the old session’s focus', async ($, on) => {
  let id = 's1'
  const { text } = await mountSession($, on, { id: () => id, transcript: 'truncated', prompt: 'implement #2331' })
  expect(await text()).toContain('issue #2331 ')
  await ($.session.end as (input: unknown) => Promise<unknown>)({ reason: 'clear', sessionId: 's1' })
  id = 's2'
  await $.prompt.submit({ text: 'go on' } as Parameters<typeof $.prompt.submit>[0])
  expect(await text()).toContain('issue #2620 ')
})

test('a subagent’s shell command does not move the session’s folder', async ($, on) => {
  const { text, kept, bash } = await mountSession($, on, {})
  await bash('cd /wt/2331 && git log', 'a1')
  expect(await text()).toContain('issue #2620 ')
  expect(kept.get('session:s1')).toBeUndefined()
  await bash('cd /wt/2331 && git log')
  expect(await text()).toContain('issue #2331 ')
})

test('a new folder clears the other worktree’s issue even while glab fails', async ($, on) => {
  let isDown = false
  const { text, bash } = await mountSession($, on, { glab: q => (isDown ? { exitCode: 1 } : GLAB(q)) })
  expect(await text()).toContain('issue #2620 ')
  isDown = true
  await bash('cd /wt/2331')
  expect(await text()).not.toContain('#2620')
})

test('a missing glab answers the command with the glab hint', async ($, on) => {
  const { command } = await mountSession($, on, { glab: () => { throw new Error('spawn glab ENOENT') } })
  expect((await command('2620')).text).toBe('The GitLab lookup failed: is glab installed and logged in? The line keeps what it showed.')
})

test('after /clear a refresh of the old session does not write, and the new session loads its own focus', async ($, on) => {
  let id = 's1'
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  let isSlow = false
  const s2 = { focus: { kind: 'issue', iid: 2331, host: null, project: null, source: 'pin' }, workdir: null, at: 0 }
  const { text, clock } = await mountSession($, on, {
    id: () => id,
    kept: [['session:s2', s2]],
    glab: async q => (isSlow && q.includes('"2620"') ? (await gate, GLAB(q)) : GLAB(q)),
  })
  expect(await text()).toContain('issue #2620 ')
  isSlow = true
  await clock.advance(2 * 60_000)
  await ($.session.end as (input: unknown) => Promise<unknown>)({ reason: 'clear', sessionId: 's1' })
  id = 's2'
  release()
  await clock.advance(0)
  expect(await text()).not.toContain('#2620')
  await $.prompt.submit({ text: 'go on' } as Parameters<typeof $.prompt.submit>[0])
  await clock.advance(0)
  expect(await text()).toContain('issue #2331 ')
})

test('a slow transcript scan of the old session does not overwrite the new session’s focus', async ($, on) => {
  let id = 's1'
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  const s2 = { focus: { kind: 'issue', iid: 2331, host: null, project: null, source: 'pin' }, workdir: null, at: 0 }
  const { command } = await mountSession($, on, {
    id: () => id,
    kept: [['session:s2', s2]],
    transcript: async () => (await gate, { prompts: ['implement #2620'], commands: [] }),
  })
  await ($.session.end as (input: unknown) => Promise<unknown>)({ reason: 'clear', sessionId: 's1' })
  id = 's2'
  await $.prompt.submit({ text: 'go on' } as Parameters<typeof $.prompt.submit>[0])
  release()
  expect(await command('')).toEqual({ text: '#2331 Import the member list (pinned)' })
})

test('a lookup that ends while a new focus is being saved does not write the old issue', async ($, on) => {
  let releaseGlab: () => void = () => {}
  let releaseStore: () => void = () => {}
  const glabGate = new Promise<void>(resolve => { releaseGlab = resolve })
  const storeGate = new Promise<void>(resolve => { releaseStore = resolve })
  let isSlow = false
  const { text, clock } = await mountSession($, on, {
    glab: async q => (isSlow && q.includes('"2620"') ? (await glabGate, GLAB(q)) : GLAB(q)),
    storeSet: () => (isSlow ? storeGate : Promise.resolve()),
  })
  isSlow = true
  await clock.advance(2 * 60_000)
  const pin = $.command.run({ command: 'issue-line', args: '2331' } as Parameters<typeof $.command.run>[0])
  await clock.advance(0)
  releaseGlab()
  await clock.advance(0)
  expect(await text()).not.toContain('#2620')
  releaseStore()
  await pin
})
