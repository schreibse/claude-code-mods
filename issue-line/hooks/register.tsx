import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Focus, IssueLine, MergeRequest } from '../types'

const lineAtom = atom({ plugin: 'issue-line', key: 'line' } as const, null)
const focusAtom = atom({ plugin: 'issue-line', key: 'focus' } as const, null)
const workdirAtom = atom({ plugin: 'issue-line', key: 'workdir' } as const, null)

const TICK_MS = 2 * 60_000
const TITLE_MAX = 40
const FOCUS_KEY = 'focus-by-session'
const FOCUS_KEEP = 100

const MR_FIELDS = 'iid state draft webUrl sourceBranch resolvableDiscussionsCount resolvedDiscussionsCount headPipeline { status }'

type GqlMr = { iid: string; state: string; draft: boolean; webUrl: string; sourceBranch: string; resolvableDiscussionsCount: number; resolvedDiscussionsCount: number; headPipeline?: { status: string } | null }
type GqlIssue = { iid: string; title: string; state: string; webUrl: string; relatedMergeRequests: { nodes: GqlMr[] } }
type GqlProject = { issue?: GqlIssue | null; mergeRequest?: (GqlMr & { title: string }) | null }
type Tab = { focus: Focus | null; workdir: string | null }
type Stored = Record<string, Tab & { at: number }>

async function run($: EngineInterface, cwd: string, argv: string[]): Promise<string> {
  const result = await $.process.run(argv, { cwd, timeoutMs: 15_000 })
  return result.exitCode === 0 ? result.stdout.trim() : ''
}

export function issueNumberOf(branch: string): number | null {
  const match = /^(\d+)-/.exec(branch)
  return match === null ? null : Number(match[1])
}

// git@host:group/project.git and https://host/group/project.git alike.
export function projectPathOf(remote: string): string | null {
  const match = /^(?:[^@/]+@[^:]+:|[a-z+]+:\/\/[^/]+\/)(.+?)(?:\.git)?\/?$/.exec(remote)
  return match?.[1] ?? null
}

// The first issue or MR a prompt names: a GitLab link, #1234, !1234, "issue 1234", "MR 1234".
export function focusIn(text: string): Pick<Focus, 'kind' | 'iid'> | null {
  const patterns: [RegExp, Focus['kind']][] = [
    [/\/-\/merge_requests\/(\d+)/, 'mr'],
    [/\/-\/(?:issues|work_items)\/(\d+)/, 'issue'],
    [/(?:^|[\s(])!(\d{2,6})\b/, 'mr'],
    [/(?:^|[\s(])#(\d{2,6})\b/, 'issue'],
    [/\b(?:MR|merge request)\s+!?(\d{2,6})\b/i, 'mr'],
    [/\b(?:issue|ticket)\s+#?(\d{2,6})\b/i, 'issue'],
  ]
  let first: { kind: Focus['kind']; iid: number; at: number } | null = null
  for (const [pattern, kind] of patterns) {
    const match = pattern.exec(text)
    if (match !== null && (first === null || match.index < first.at)) {
      first = { kind, iid: Number(match[1]), at: match.index }
    }
  }
  return first === null ? null : { kind: first.kind, iid: first.iid }
}

// The folder a shell command works in: `cd <dir>` at its start, or `git -C <dir>`.
export function workdirIn(command: string, home: string): string | null {
  const match =
    /^\s*cd\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/.exec(command) ??
    /\bgit\s+-C\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/.exec(command)
  const dir = match?.[1] ?? match?.[2] ?? match?.[3]
  if (dir === undefined) {
    return null
  }
  const absolute = dir.startsWith('~/') ? `${home}${dir.slice(1)}` : dir
  return absolute.startsWith('/') ? absolute.replace(/\/+$/, '') : null
}

// A resumed tab's past: its prompts and its shell commands, read from the transcript.
const SCAN = `
import json, os, sys
prompts, commands = [], []
try:
    with open(os.path.expanduser(sys.argv[1])) as f:
        for line in f:
            try:
                o = json.loads(line)
            except ValueError:
                continue
            if o.get("isSidechain"):
                continue
            c = (o.get("message") or {}).get("content")
            if o.get("type") == "user" and not o.get("isMeta") and isinstance(c, str) and not c.startswith("<"):
                prompts.append(c[:4000])
            elif o.get("type") == "assistant" and isinstance(c, list):
                commands += [b["input"].get("command", "")[:500] for b in c if b.get("type") == "tool_use" and b.get("name") == "Bash"]
except OSError:
    pass
print(json.dumps({"prompts": prompts, "commands": commands}))
`

async function scanTranscript($: EngineInterface, home: string): Promise<Tab> {
  const slug = (await $.session.root()).replace(/[^a-zA-Z0-9]/g, '-')
  const file = `~/.claude/projects/${slug}/${await $.session.id()}.jsonl`
  const json = await run($, home, ['python3', '-I', '-c', SCAN, file])
  const { prompts, commands } = (json === '' ? { prompts: [], commands: [] } : JSON.parse(json)) as { prompts: string[]; commands: string[] }
  const found = prompts.map(focusIn).find(f => f !== null) ?? null
  const workdir = commands.map(c => workdirIn(c, home)).filter(d => d !== null).at(-1) ?? null
  return { focus: found === null ? null : { ...found, source: 'prompt' }, workdir }
}

// Of an issue's MRs: the one on the tab's branch, else the one the tab named, else the only open one.
export function pickMr(mrs: readonly GqlMr[], iid: number, branch: string, namedMr: number | null): { mr: GqlMr | null; openMrs: number } {
  const own = mrs.filter(mr => mr.sourceBranch.startsWith(`${iid}-`))
  const open = own.filter(mr => mr.state === 'opened')
  const mr =
    own.find(m => m.sourceBranch === branch) ??
    own.find(m => Number(m.iid) === namedMr) ??
    (open.length === 1 ? open[0] : undefined) ??
    (open.length === 0 ? own[0] : undefined) ??
    null
  return { mr, openMrs: mr === null ? open.length : 0 }
}

function toMr(mr: GqlMr): MergeRequest {
  return {
    iid: Number(mr.iid),
    state: mr.state,
    draft: mr.draft,
    url: mr.webUrl,
    threads: mr.resolvableDiscussionsCount,
    openThreads: mr.resolvableDiscussionsCount - mr.resolvedDiscussionsCount,
    pipeline: mr.headPipeline?.status ?? null,
  }
}

async function project($: EngineInterface, cwd: string, path: string, fields: string): Promise<GqlProject | null> {
  const json = await run($, cwd, ['glab', 'api', 'graphql', '-f', `query={ project(fullPath: ${JSON.stringify(path)}) { ${fields} } }`])
  return json === '' ? null : ((JSON.parse(json) as { data?: { project?: GqlProject | null } }).data?.project ?? null)
}

async function fetchLine($: EngineInterface, cwd: string, path: string, focus: Focus | null, branch: string): Promise<IssueLine | null> {
  let iid = focus?.kind === 'issue' ? focus.iid : issueNumberOf(branch)
  let named: (GqlMr & { title: string }) | null = null
  if (focus?.kind === 'mr') {
    named = (await project($, cwd, path, `mergeRequest(iid: "${focus.iid}") { title ${MR_FIELDS} }`))?.mergeRequest ?? null
    iid = named === null ? null : issueNumberOf(named.sourceBranch)
  }
  const isPinned = focus?.source === 'pin'
  if (iid === null) {
    return named === null ? null : { issue: { iid: 0, title: named.title, state: '', url: named.webUrl }, mr: toMr(named), openMrs: 0, isPinned }
  }
  const issueFields = `issue(iid: "${iid}") { iid title state webUrl relatedMergeRequests(first: 30) { nodes { ${MR_FIELDS} } } }`
  const issue = (await project($, cwd, path, issueFields))?.issue ?? null
  if (issue === null) {
    return null
  }
  const picked = named !== null ? { mr: named, openMrs: 0 } : pickMr(issue.relatedMergeRequests.nodes, iid, branch, null)
  return {
    issue: { iid: Number(issue.iid), title: issue.title, state: issue.state, url: issue.webUrl },
    mr: picked.mr === null ? null : toMr(picked.mr),
    openMrs: picked.openMrs,
    isPinned,
  }
}

async function refresh($: EngineInterface): Promise<void> {
  const workdir = await read($, workdirAtom)
  const sessionCwd = await $.session.cwd()
  const gitAt = (dir: string) =>
    Promise.all([run($, dir, ['git', 'branch', '--show-current']), run($, dir, ['git', 'remote', 'get-url', 'origin'])])
  // A folder the tab cd'd into that is no repository (a scratch dir) leaves the session's own.
  let [cwd, [branch, remote]] = [workdir ?? sessionCwd, await gitAt(workdir ?? sessionCwd)]
  if (remote === '' && workdir !== null) {
    ;[cwd, [branch, remote]] = [sessionCwd, await gitAt(sessionCwd)]
  }
  const path = projectPathOf(remote)
  const focus = await read($, focusAtom)
  if (path === null || (focus === null && issueNumberOf(branch) === null)) {
    await update($, lineAtom, () => null)
    return
  }
  const line = await fetchLine($, cwd, path, focus, branch)
  // A failed fetch keeps the last line rather than blanking it.
  await update($, lineAtom, last => line ?? last)
}

function startRefresh($: EngineInterface): void {
  void refresh($).catch((error: unknown) => $.ui.log(`issue-line: ${String(error)}`, { to: 'debug' }))
}

async function saveTab($: EngineInterface, tab: Partial<Tab>): Promise<void> {
  if (tab.focus !== undefined) {
    await update($, focusAtom, () => tab.focus ?? null)
  }
  if (tab.workdir !== undefined) {
    await update($, workdirAtom, () => tab.workdir ?? null)
  }
  const id = await $.session.id()
  const stored = ((await $.store.get(FOCUS_KEY)) ?? {}) as Stored
  stored[id] = { focus: await read($, focusAtom), workdir: await read($, workdirAtom), at: await $.clock.now() }
  const kept = Object.entries(stored).sort(([, a], [, b]) => b.at - a.at).slice(0, FOCUS_KEEP)
  await $.store.set(FOCUS_KEY, Object.fromEntries(kept))
}

// The glyphs and tones of usage-percent's `ci` piece, for the MR's head pipeline.
export function ciOf(status: string | null): { glyph: string; tone: 'green' | 'red' | 'dim' } | null {
  switch (status) {
    case null:
      return null
    case 'SUCCESS':
      return { glyph: '✓', tone: 'green' }
    case 'FAILED':
      return { glyph: '✗', tone: 'red' }
    case 'MANUAL':
      return { glyph: '⏸', tone: 'dim' }
    case 'CANCELED':
    case 'SKIPPED':
      return { glyph: status.toLowerCase(), tone: 'dim' }
    default:
      return { glyph: '⏳', tone: 'dim' }
  }
}

function shorten(text: string): string {
  return text.length <= TITLE_MAX ? text : `${text.slice(0, TITLE_MAX - 1)}…`
}

export const register: Register = on => {
  let timer: Timer | null = null
  let home = ''

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'issue-line', description: 'This tab’s GitLab issue: /issue-line [1234 | !1234 | auto]' })
    home = await run($, '/', ['printenv', 'HOME'])
    const stored = ((await $.store.get(FOCUS_KEY)) ?? {}) as Stored
    const saved: Tab = stored[await $.session.id()] ?? (await scanTranscript($, home))
    await update($, focusAtom, focus => focus ?? saved.focus)
    await update($, workdirAtom, workdir => workdir ?? saved.workdir)
    timer?.cancel()
    startRefresh($)
    timer = $.clock.every(TICK_MS, () => startRefresh($))
    return result
  })

  // The first issue or MR a tab is told about is its focus; a pin or `/issue-line auto` changes it.
  on('prompt.submit', async ($, e, next) => {
    const found = focusIn(e.text)
    if (found !== null && (await read($, focusAtom)) === null) {
      await saveTab($, { focus: { ...found, source: 'prompt' } })
      startRefresh($)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const workdir = e.tool === 'Bash' && home !== '' ? workdirIn(e.command, home) : null
    if (workdir !== null && workdir !== (await read($, workdirAtom))) {
      await saveTab($, { workdir })
    }
    if ((e.tool === 'Bash' && /\b(git|glab|cd)\b/.test(e.command)) || e.tool.startsWith('mcp__gitlab__')) {
      startRefresh($)
    }
    return result
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'issue-line' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'auto') {
      await saveTab($, { focus: null })
    } else if (arg !== '') {
      const found = focusIn(/^\d+$/.test(arg) ? `#${arg}` : arg)
      if (found === null) {
        return { text: `Not an issue or MR: ${arg}. Use 1234, #1234, !1234 or a GitLab link.` }
      }
      await saveTab($, { focus: { ...found, source: 'pin' } })
    }
    await refresh($)
    const line = await read($, lineAtom)
    const focus = await read($, focusAtom)
    const workdir = (await read($, workdirAtom)) ?? (await $.session.cwd())
    const how = focus === null ? `from the branch in ${workdir}` : focus.source === 'pin' ? 'pinned' : 'from your prompt'
    return { text: line?.issue == null ? 'This tab has no issue yet.' : `#${line.issue.iid} ${line.issue.title} (${how})` }
  })

  // On the hint line, at its right end: next to the usage figures, not a row of its own.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const hint = await next(e)
    const line = await read($, lineAtom)
    if (line?.issue == null) {
      return hint
    }
    const { Box, Text, Link } = $.ui.resolve(e)
    const { issue, mr } = line
    const isClosed = issue.state === 'closed'
    // Claude Code's own hint line already names the branch's MR (`MR !2723`): no second copy.
    const isMrInHint = mr !== null && new RegExp(`!${mr.iid}\\b`).test(e.props.hint)
    const mrState = mr === null ? '' : mr.draft ? ' draft' : mr.state === 'opened' ? '' : ` ${mr.state}`
    const ci = ciOf(mr?.pipeline ?? null)
    const threads = mr === null || mr.threads === 0 ? '' : mr.openThreads > 0 ? `💬 ${mr.openThreads}` : '✓'
    // The look of the usage row beside it: a dim label, the value dim, colour only for a state.
    return (
      <Box alignItems="flex-start">
        {hint}
        <Box flexGrow={1}>
          <Text> </Text>
        </Box>
        <Box flexShrink={1} flexWrap="nowrap" minWidth={0} height={1} overflow="hidden">
          <Box flexShrink={0}>
            <Text dimColor>{issue.iid === 0 ? 'mr ' : 'issue '}</Text>
            {issue.iid === 0 ? null : (
              <Link href={issue.url}>
                <Text color={isClosed ? 'red' : undefined}>{`#${issue.iid}`}</Text>
              </Link>
            )}
            <Text color="red">{isClosed ? ' closed' : ''}</Text>
            <Text dimColor>{' '}</Text>
          </Box>
          <Box flexShrink={1} minWidth={8} height={1} overflow="hidden">
            <Link href={issue.url}>
              <Text dimColor wrap="truncate-end">{shorten(issue.title)}</Text>
            </Link>
          </Box>
          <Box flexShrink={0}>
            <Text dimColor>{mr === null && line.openMrs > 1 ? ` · ${line.openMrs} open mrs` : ''}</Text>
            <Text dimColor>{mr !== null && !isMrInHint ? ' · mr ' : ''}</Text>
            {mr === null || isMrInHint ? null : (
              <Link href={mr.url}>
                <Text>{`!${mr.iid}`}</Text>
              </Link>
            )}
            <Text color={mr?.state === 'closed' ? 'red' : undefined} dimColor={mr?.state !== 'closed'}>{isMrInHint ? '' : mrState}</Text>
            <Text dimColor>{ci === null ? '' : ' · ci '}</Text>
            <Text color={ci?.tone === 'dim' ? undefined : ci?.tone} dimColor={ci?.tone === 'dim'}>{ci?.glyph ?? ''}</Text>
            <Text dimColor>{threads === '' ? '' : ' · threads '}</Text>
            <Text color={mr !== null && mr.openThreads > 0 ? 'yellow' : 'green'}>{threads}</Text>
          </Box>
        </Box>
      </Box>
    )
  })
}
