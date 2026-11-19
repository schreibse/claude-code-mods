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

const MR_FIELDS = 'iid title state draft webUrl sourceBranch resolvableDiscussionsCount resolvedDiscussionsCount headPipeline { status }'

type GqlMr = { iid: string; title: string; state: string; draft: boolean; webUrl: string; sourceBranch: string; resolvableDiscussionsCount: number; resolvedDiscussionsCount: number; headPipeline?: { status: string } | null }
type GqlIssue = { iid: string; title: string; state: string; webUrl: string; relatedMergeRequests: { nodes: GqlMr[] } }
type GqlProject = { issue?: GqlIssue | null; mergeRequest?: GqlMr | null }
type Session = { focus: Focus | null; workdir: string | null }
type Stored = Record<string, Session & { at: number }>
type Found = Pick<Focus, 'kind' | 'iid' | 'project'>
type Lookup = IssueLine | null | 'error'
type Context = { home: string; seq: number; loaded: { id: string; done: Promise<void> } | null }

async function run($: EngineInterface, cwd: string, argv: string[]): Promise<string> {
  const result = await $.process.run(argv, { cwd, timeoutMs: 15_000 })
  return result.exitCode === 0 ? result.stdout.trim() : ''
}

export function issueNumberOf(branch: string): number | null {
  const match = /^(\d+)-/.exec(branch)
  return match === null ? null : Number(match[1])
}

// git@host:group/project.git and https://host/group/project.git alike; GitHub and Azure are no GitLab.
export function projectPathOf(remote: string): string | null {
  if (/(^|[@/.])(github\.com|dev\.azure\.com|visualstudio\.com)[:/]/.test(remote)) {
    return null
  }
  const match = /^(?:[^@/]+@[^:]+:|[a-z+]+:\/\/[^/]+\/)(.+?)(?:\.git)?\/?$/.exec(remote)
  return match?.[1] ?? null
}

// What stands before a `#12` that is no issue: `line #42`, `PR #12`, `color: #333`.
const NOT_AN_ISSUE = /(?:\b(?:lines?|rows?|steps?|items?|page|no\.?|number|pr|pull request|github|gh|colou?r|fill|stroke|background|border|solid)|:)\s*$/i

function hashIn(text: string): { at: number; iid: number } | null {
  for (const match of text.matchAll(/(?:^|[\s(])#(\d{2,5})(?![\w;])/g)) {
    const at = match.index + match[0].indexOf('#')
    if (!NOT_AN_ISSUE.test(text.slice(Math.max(0, at - 24), at))) {
      return { at, iid: Number(match[1]) }
    }
  }
  return null
}

export function focusIn(text: string): Found | null {
  const found: (Found & { at: number })[] = []
  const link = /https?:\/\/[^/\s]+\/([^\s?#]+?)\/-\/(merge_requests|issues|work_items)\/(\d+)/.exec(text)
  if (link !== null) {
    found.push({ kind: link[2] === 'merge_requests' ? 'mr' : 'issue', iid: Number(link[3]), project: link[1]!, at: link.index })
  }
  const hash = hashIn(text)
  if (hash !== null) {
    found.push({ kind: 'issue', iid: hash.iid, project: null, at: hash.at })
  }
  const patterns: [RegExp, Focus['kind']][] = [
    [/(?:^|[\s(])!(\d{2,6})\b/, 'mr'],
    [/\b(?:MR|merge request)\s+!?(\d{2,6})\b/i, 'mr'],
    [/\bissue\s+#?(\d{2,6})\b/i, 'issue'],
  ]
  for (const [pattern, kind] of patterns) {
    const match = pattern.exec(text)
    if (match !== null) {
      found.push({ kind, iid: Number(match[1]), project: null, at: match.index })
    }
  }
  const first = found.sort((a, b) => a.at - b.at)[0]
  return first === undefined ? null : { kind: first.kind, iid: first.iid, project: first.project }
}

const DIR = String.raw`(?:"([^"]+)"|'([^']+)'|([^\s;&|)]+))`

export function workdirIn(command: string, home: string): string | null {
  const matches = [
    ...command.matchAll(new RegExp(String.raw`(?:^|[;&|(])\s*cd\s+${DIR}`, 'g')),
    ...command.matchAll(new RegExp(String.raw`\bgit\s+-C\s+${DIR}`, 'g')),
  ].sort((a, b) => a.index - b.index)
  let last: string | null = null
  for (const match of matches) {
    const dir = (match[1] ?? match[2] ?? match[3])!.replace(/^(?:~|\$HOME|\$\{HOME\})(?=\/|$)/, home)
    if (dir.startsWith('/')) {
      last = dir.length > 1 ? dir.replace(/\/+$/, '') : dir
    }
  }
  return last
}

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

async function scanTranscript($: EngineInterface, home: string, id: string): Promise<Session> {
  const slug = (await $.session.root()).replace(/[^a-zA-Z0-9]/g, '-')
  const json = await run($, home, ['python3', '-I', '-c', SCAN, `~/.claude/projects/${slug}/${id}.jsonl`])
  const { prompts, commands } = (json === '' ? { prompts: [], commands: [] } : JSON.parse(json)) as { prompts: string[]; commands: string[] }
  const found = prompts.map(focusIn).find(f => f !== null) ?? null
  const workdir = commands.map(c => workdirIn(c, home)).filter(d => d !== null).at(-1) ?? null
  return { focus: found === null ? null : { ...found, source: 'prompt' }, workdir }
}

// Of an issue's MRs: the one on the session's branch, else the only open one of those on `<iid>-…` branches
// (of all linked ones when no branch is named so), else the newest of them when none is open.
export function pickMr(mrs: readonly GqlMr[], iid: number, branch: string): { mr: GqlMr | null; openMrs: number } {
  const own = mrs.filter(mr => mr.sourceBranch.startsWith(`${iid}-`))
  const pool = own.length > 0 ? own : mrs.filter(mr => mr.state === 'opened')
  const open = pool.filter(mr => mr.state === 'opened')
  const mr =
    mrs.find(m => m.sourceBranch === branch) ??
    (open.length === 1 ? open[0] : undefined) ??
    (open.length === 0 ? pool[0] : undefined) ??
    null
  return { mr, openMrs: mr === null ? open.length : 0 }
}

function toMr(mr: GqlMr): MergeRequest {
  return {
    iid: Number(mr.iid),
    title: mr.title,
    state: mr.state,
    draft: mr.draft,
    url: mr.webUrl,
    threads: mr.resolvableDiscussionsCount,
    openThreads: mr.resolvableDiscussionsCount - mr.resolvedDiscussionsCount,
    pipeline: mr.headPipeline?.status ?? null,
  }
}

async function project($: EngineInterface, cwd: string, path: string, fields: string): Promise<GqlProject | null | 'error'> {
  const query = `query={ project(fullPath: ${JSON.stringify(path)}) { ${fields} } }`
  const result = await $.process.run(['glab', 'api', 'graphql', '-f', query], { cwd, timeoutMs: 15_000 })
  if (result.exitCode !== 0) {
    return 'error'
  }
  return (JSON.parse(result.stdout) as { data?: { project?: GqlProject | null } }).data?.project ?? null
}

async function fetchLine($: EngineInterface, cwd: string, path: string, focus: Focus | null, branch: string): Promise<Lookup> {
  let iid = focus?.kind === 'issue' ? focus.iid : issueNumberOf(branch)
  let named: GqlMr | null = null
  if (focus?.kind === 'mr') {
    const found = await project($, cwd, path, `mergeRequest(iid: "${focus.iid}") { ${MR_FIELDS} }`)
    if (found === 'error' || found?.mergeRequest == null) {
      return found === 'error' ? 'error' : null
    }
    named = found.mergeRequest
    iid = issueNumberOf(named.sourceBranch)
  }
  const mrOnly = named === null ? null : { issue: null, mr: toMr(named), openMrs: 0 }
  if (iid === null) {
    return mrOnly
  }
  const found = await project($, cwd, path, `issue(iid: "${iid}") { iid title state webUrl relatedMergeRequests(first: 30) { nodes { ${MR_FIELDS} } } }`)
  if (found === 'error' || found?.issue == null) {
    return found === 'error' && mrOnly === null ? 'error' : mrOnly
  }
  const { issue } = found
  const picked = named !== null ? { mr: named, openMrs: 0 } : pickMr(issue.relatedMergeRequests.nodes, iid, branch)
  return {
    issue: { iid: Number(issue.iid), title: issue.title, state: issue.state, url: issue.webUrl },
    mr: picked.mr === null ? null : toMr(picked.mr),
    openMrs: picked.openMrs,
  }
}

// The focus and folder of the session the process now runs: a `/clear` or `/resume` changes the id, not the module.
async function ensureLoaded($: EngineInterface, ctx: Context): Promise<boolean> {
  const id = await $.session.id()
  const isNew = ctx.loaded?.id !== id
  if (isNew) {
    const load = async () => {
      const stored = ((await $.store.get(FOCUS_KEY)) ?? {}) as Stored
      const saved: Session = stored[id] ?? (await scanTranscript($, ctx.home, id))
      await update($, focusAtom, () => saved.focus)
      await update($, workdirAtom, () => saved.workdir)
    }
    ctx.loaded = { id, done: load() }
  }
  await ctx.loaded!.done
  return isNew
}

// Only the newest of overlapping refreshes writes the line; a transient failure keeps the last one.
async function refresh($: EngineInterface, ctx: Context): Promise<Lookup> {
  const seq = ++ctx.seq
  await ensureLoaded($, ctx)
  const workdir = await read($, workdirAtom)
  const sessionCwd = await $.session.cwd()
  const gitAt = (dir: string) =>
    Promise.all([run($, dir, ['git', 'branch', '--show-current']), run($, dir, ['git', 'remote', 'get-url', 'origin'])])
  // A folder the session cd'd into that is no repository (a scratch dir) leaves the session's own.
  let [cwd, [branch, remote]] = [workdir ?? sessionCwd, await gitAt(workdir ?? sessionCwd)]
  if (remote === '' && workdir !== null) {
    ;[cwd, [branch, remote]] = [sessionCwd, await gitAt(sessionCwd)]
  }
  const focus = await read($, focusAtom)
  const path = focus?.project ?? projectPathOf(remote)
  const line = path === null || (focus === null && issueNumberOf(branch) === null) ? null : await fetchLine($, cwd, path, focus, branch)
  if (seq === ctx.seq) {
    await update($, lineAtom, last => (line === 'error' ? last : line))
  }
  return line
}

async function saveSession($: EngineInterface, session: Partial<Session>): Promise<void> {
  if (session.focus !== undefined) {
    await update($, focusAtom, () => session.focus ?? null)
    await update($, lineAtom, () => null)
  }
  if (session.workdir !== undefined) {
    await update($, workdirAtom, () => session.workdir ?? null)
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
    case 'SUCCESS':
      return { glyph: '✓', tone: 'green' }
    case 'FAILED':
    case 'CANCELED':
      return { glyph: '✗', tone: 'red' }
    case 'MANUAL':
      return { glyph: '⏸', tone: 'dim' }
    case 'RUNNING':
    case 'PENDING':
    case 'CREATED':
    case 'PREPARING':
    case 'WAITING_FOR_RESOURCE':
      return { glyph: '⏳', tone: 'dim' }
    default:
      return null
  }
}

export function shorten(text: string): string {
  return text.length <= TITLE_MAX ? text : `${text.slice(0, TITLE_MAX - 1).trimEnd()}…`
}

function startRefresh($: EngineInterface, ctx: Context): void {
  void refresh($, ctx).catch((error: unknown) => $.ui.log(`issue-line: ${String(error)}`, { to: 'debug' }))
}

function pinOf(arg: string): Found | null {
  const number = /^([#!]?)(\d+)$/.exec(arg)
  return number === null ? focusIn(arg) : { kind: number[1] === '!' ? 'mr' : 'issue', iid: Number(number[2]), project: null }
}

export const register: Register = on => {
  let timer: Timer | null = null
  const ctx: Context = { home: '', seq: 0, loaded: null }

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'issue-line', description: 'This session’s GitLab issue: /issue-line [1234 | !1234 | auto]' })
    ctx.home = await run($, '/', ['printenv', 'HOME'])
    timer?.cancel()
    startRefresh($, ctx)
    timer = $.clock.every(TICK_MS, () => startRefresh($, ctx))
    return result
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear' || e.reason === 'resume') {
      ctx.loaded = null
      await update($, lineAtom, () => null)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // The first issue or MR a session is told about is its focus; a pin or `/issue-line auto` changes it.
  on('prompt.submit', async ($, e, next) => {
    const isNew = await ensureLoaded($, ctx)
    const found = focusIn(e.text)
    if (found !== null && (await read($, focusAtom)) === null) {
      await saveSession($, { focus: { ...found, source: 'prompt' } })
      startRefresh($, ctx)
    } else if (isNew) {
      startRefresh($, ctx)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const workdir = e.tool === 'Bash' && ctx.home !== '' ? workdirIn(e.command, ctx.home) : null
    if (workdir !== null && workdir !== (await read($, workdirAtom))) {
      await saveSession($, { workdir })
    }
    if ((e.tool === 'Bash' && /\b(git|glab|cd)\b/.test(e.command)) || e.tool.startsWith('mcp__gitlab__')) {
      startRefresh($, ctx)
    }
    return result
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'issue-line' }, async ($, e) => {
    const arg = e.args.trim()
    try {
      await ensureLoaded($, ctx)
      if (arg === 'auto') {
        await saveSession($, { focus: null })
      } else if (arg !== '') {
        const found = pinOf(arg)
        if (found === null) {
          return { text: `Not an issue or MR: ${arg}. Use 1234, #1234, !1234 or a GitLab link.` }
        }
        await saveSession($, { focus: { ...found, source: 'pin' } })
      }
      const line = await refresh($, ctx)
      const focus = await read($, focusAtom)
      if (line === 'error') {
        return { text: 'The GitLab lookup failed: is glab installed and logged in? The line keeps what it showed.' }
      }
      if (line === null) {
        const name = focus === null ? '' : `${focus.kind === 'mr' ? '!' : '#'}${focus.iid}${focus.project === null ? '' : ` in ${focus.project}`}`
        return { text: focus === null ? 'This session has no issue: name one, or work on a branch named <issue>-….' : `Nothing found for ${name}.` }
      }
      const workdir = (await read($, workdirAtom)) ?? (await $.session.cwd())
      const how = focus === null ? `from the branch in ${workdir}` : focus.source === 'pin' ? 'pinned' : 'from your prompt'
      const name = line.issue !== null ? `#${line.issue.iid} ${line.issue.title}` : `!${line.mr!.iid} ${line.mr!.title}`
      return { text: `${name} (${how})` }
    } catch (error) {
      return { text: `The GitLab lookup failed: ${String(error)}` }
    }
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const hint = await next(e)
    const line = await read($, lineAtom)
    const mr = line?.mr ?? null
    const issue = line?.issue ?? null
    if (issue === null && mr === null) {
      return hint
    }
    const { Box, Text, Link } = $.ui.resolve(e)
    // Claude Code's own hint line already names the branch's MR (`MR !2723`): no second copy of the number.
    const isMrInHint = mr !== null && new RegExp(`!${mr.iid}\\b`).test(e.props.hint)
    const head =
      issue !== null
        ? { label: 'issue ', number: `#${issue.iid}`, url: issue.url, title: issue.title, isClosed: issue.state === 'closed' }
        : { label: 'mr ', number: isMrInHint ? '' : `!${mr!.iid}`, url: mr!.url, title: mr!.title, isClosed: false }
    const mrState = mr === null ? '' : mr.draft ? 'draft' : mr.state === 'opened' ? '' : mr.state
    const mrNumber = mr === null || isMrInHint || issue === null ? '' : `!${mr.iid}`
    const mrLead = issue !== null && (mrNumber !== '' || mrState !== '') ? ' · mr ' : mrState !== '' ? ' · ' : ''
    const ci = ciOf(mr?.pipeline ?? null)
    const threads = mr === null || mr.threads === 0 ? '' : mr.openThreads > 0 ? `💬 ${mr.openThreads}` : '✓'
    return (
      <Box alignItems="flex-start">
        {hint}
        <Box flexGrow={1}>
          <Text> </Text>
        </Box>
        <Box flexShrink={1} flexWrap="nowrap" minWidth={0} height={1} overflow="hidden">
          <Box flexShrink={0}>
            <Text dimColor>{head.label}</Text>
            {head.number === '' ? null : (
              <Link href={head.url}>
                <Text color={head.isClosed ? 'red' : undefined}>{head.number}</Text>
              </Link>
            )}
            <Text color="red">{head.isClosed ? ' closed' : ''}</Text>
            <Text dimColor>{head.number === '' ? '' : ' '}</Text>
          </Box>
          <Box flexShrink={1} minWidth={8} height={1} overflow="hidden">
            <Link href={head.url}>
              <Text dimColor wrap="truncate-end">{shorten(head.title)}</Text>
            </Link>
          </Box>
          <Box flexShrink={0}>
            <Text dimColor>{mr === null && line!.openMrs > 1 ? ` · ${line!.openMrs} open mrs` : ''}</Text>
            <Text dimColor>{mrLead}</Text>
            {mrNumber === '' ? null : (
              <Link href={mr!.url}>
                <Text>{mrNumber}</Text>
              </Link>
            )}
            <Text color={mrState === 'closed' ? 'red' : undefined} dimColor={mrState !== 'closed'}>
              {`${mrNumber !== '' && mrState !== '' ? ' ' : ''}${mrState}`}
            </Text>
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
