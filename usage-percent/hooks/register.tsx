import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionRateLimit, Timer } from 'claude-code'

import { containerOf, directoriesOf, isUnder, memory, pressureAvg10, servedIn, serveProcesses } from './machine'
import type { ServeProcess } from './machine'
import { dim, joined, toneOf } from './pieces'
import { forgeOf, hostOf, githubPipeline, gitlabPipeline, pipeline } from './pipeline'
import type { Pipeline } from './pipeline'
import { scopedWindows, USAGE_URL } from './scoped'
import type { ScopedWindow } from './scoped'
import type { Piece } from '../types'

const WINDOWS: Record<string, string> = { five_hour: '5h', seven_day: 'wk' }
const TICK_MS = 10_000
const PIPELINE_RUNNING_MS = 60_000
const PIPELINE_IDLE_MS = 300_000
const AFTER_PUSH_MS = 15_000
const SCOPED_MS = 60_000
const RESET_GAP = ' '.repeat(8)

const usageLine = atom({ plugin: 'usage-percent', key: 'line' } as const, null)
const nxLine = atom({ plugin: 'usage-percent', key: 'nx' } as const, null)

type Poll = { root: string; uid: string; head: string; pipelineAt: number; pushedAt: number; pipe: Pipeline | null; composeDirs: Map<string, string>; isBusy: boolean }

const BAR_CELLS = 4

function bar(percent: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * BAR_CELLS)
  return '▰'.repeat(filled) + '▱'.repeat(BAR_CELLS - filled)
}

// Time until a window resets, in its two largest units: 1d5h, 3h12m, 45m.
export function resetIn(iso: string | undefined, now: number): string {
  const ms = iso ? Date.parse(iso) - now : NaN
  if (!Number.isFinite(ms) || ms <= 0) {
    return ''
  }
  const minutes = Math.floor(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60
  if (days >= 1) {
    return hours > 0 ? `${days}d${hours}h` : `${days}d`
  }
  if (hours >= 1) {
    return rest > 0 ? `${hours}h${rest}m` : `${hours}h`
  }
  return `${Math.max(1, rest)}m`
}

function figure(label: string, percent: number): Piece[] {
  return [dim(`${label} `), { text: `${bar(percent)} ${Math.round(percent)}%`, tone: toneOf(percent) }]
}

export function isGitPush(command: string): boolean {
  return /\bgit(?:\s+-[Cc]\s+\S+)*\s+push\b/.test(command)
}

// The weekly windows share one reset, drawn once a gap after the bars; the 5h reset is left out.
export function line(context: SessionContextUsage, rateLimits: readonly SessionRateLimit[], now = Date.now(), scoped: readonly ScopedWindow[] = []): Piece[] {
  const limits = rateLimits.flatMap(limit => {
    const label = WINDOWS[limit.kind]
    return label === undefined ? [] : [{ label, percentUsed: limit.percentUsed, resetsAt: limit.resetsAt }]
  })
  const windows = [...limits, ...scoped]
  const left = joined([figure('ctx', context.percent ?? 0), ...windows.map(w => figure(w.label, w.percentUsed))], ' | ')
  const week = resetIn(windows.find(w => w.label === 'wk')?.resetsAt ?? scoped[0]?.resetsAt, now)
  return week === '' ? left : [...left, dim(`${RESET_GAP}resets ${week}`)]
}

type Usage = { context: SessionContextUsage; rateLimits: readonly SessionRateLimit[]; scoped: ScopedWindow[]; scopedAt: number; isFetching: boolean }

async function redraw($: EngineInterface, usage: Usage): Promise<void> {
  const now = await $.clock.now()
  await update($, usageLine, () => line(usage.context, usage.rateLimits, now, usage.scoped))
}

// The model-scoped week comes from the usage endpoint, at most once a minute; a failed fetch keeps the last reading.
async function refreshScoped($: EngineInterface, usage: Usage): Promise<void> {
  const now = await $.clock.now()
  if (usage.isFetching || now - usage.scopedAt < SCOPED_MS) {
    return
  }
  usage.isFetching = true
  try {
    const auth = (await $.session.authorize())?.handle
    if (auth === undefined) {
      return
    }
    const response = await $.http.fetch(USAGE_URL, { auth, headers: { 'anthropic-beta': 'oauth-2025-04-20' } })
    if (response.ok) {
      usage.scoped = scopedWindows(response.text)
      await redraw($, usage)
    }
  } finally {
    usage.scopedAt = now
    usage.isFetching = false
  }
}

function startRefresh($: EngineInterface, usage: Usage): void {
  void refreshScoped($, usage).catch((error: unknown) => $.ui.log(`usage-percent: ${String(error)}`, { to: 'debug' }))
}

async function memoryPieces($: EngineInterface, uid: string): Promise<Piece[]> {
  const service = `/sys/fs/cgroup/user.slice/user-${uid}.slice/user@${uid}.service`
  const files = ['claude.slice/memory.current', 'claude.slice/memory.max', 'app.slice/memory.pressure']
  const contents = await Promise.all(files.map(file => $.fs.read(`${service}/${file}`))).catch(() => null)
  if (contents === null) {
    return []
  }
  const [current = '', max = '', pressure = ''] = contents
  return memory(Number(current), Number(max), pressureAvg10(pressure))
}

async function fetchPipeline($: EngineInterface, root: string): Promise<Pipeline | null> {
  const git = (...args: string[]) => $.process.run(['git', ...args], { cwd: root }).then(r => r.stdout.trim())
  const [remote, branch] = await Promise.all([git('remote', 'get-url', 'origin'), git('branch', '--show-current')])
  const forge = forgeOf(remote)
  if (forge === null || branch === '') {
    return null
  }
  const argv = forge === 'github'
    ? ['gh', 'run', 'list', '--branch', branch, '--limit', '1', '--json', 'status,conclusion,workflowName']
    : ['glab', 'ci', 'get', '--branch', branch, '--output', 'json']
  const run = await $.process.run(argv, { cwd: root, timeoutMs: 20_000 })
  if (run.exitCode !== 0) {
    // A failure is either no pipeline for the branch (show nothing) or a host the CLI is not logged in to.
    const host = hostOf(remote)
    const auth = await $.process.run([forge === 'github' ? 'gh' : 'glab', 'auth', 'status', '--hostname', host], { timeoutMs: 10_000 })
    return auth.exitCode === 0 ? null : { state: 'no-login', detail: host }
  }
  return forge === 'github' ? githubPipeline(run.stdout) : gitlabPipeline(run.stdout)
}

// A server counts when it runs in the session's tree; one in a container counts when its compose project lives there.
async function servedHere($: EngineInterface, poll: Poll, processes: readonly ServeProcess[]): Promise<string[]> {
  if (processes.length === 0) {
    return []
  }
  const pwdx = await $.process.run(['pwdx', ...processes.map(p => p.pid)])
  const dirOf = directoriesOf(pwdx.stdout)
  for (const { pid } of processes) {
    if (isUnder(dirOf.get(pid) ?? '', poll.root)) {
      continue
    }
    const container = containerOf(await $.fs.read(`/proc/${pid}/cgroup`).catch(() => ''))
    if (container !== null) {
      dirOf.set(pid, await composeDir($, poll, container))
    }
  }
  return servedIn(poll.root, processes, dirOf)
}

async function composeDir($: EngineInterface, poll: Poll, container: string): Promise<string> {
  if (!poll.composeDirs.has(container)) {
    const label = '{{index .Config.Labels "com.docker.compose.project.working_dir"}}'
    const run = await $.process.run(['docker', 'inspect', '--format', label, container], { timeoutMs: 10_000 }).catch(() => null)
    poll.composeDirs.set(container, run?.exitCode === 0 ? run.stdout.trim() : '')
  }
  return poll.composeDirs.get(container) ?? ''
}

// Memory and servers every tick; the pipeline only when HEAD moved, after a push, or when its interval is up.
async function tick($: EngineInterface, poll: Poll) {
  if (poll.isBusy) {
    return
  }
  poll.isBusy = true
  try {
    const [middle, ps, head] = await Promise.all([
      memoryPieces($, poll.uid),
      $.process.run(['ps', '-eo', 'pid,args']),
      $.process.run(['git', 'rev-parse', 'HEAD'], { cwd: poll.root }).then(r => r.stdout.trim()),
    ])
    const now = await $.clock.now()
    const interval = poll.pipe?.state === 'running' ? PIPELINE_RUNNING_MS : PIPELINE_IDLE_MS
    const isPushSettled = poll.pushedAt > 0 && now - poll.pushedAt >= AFTER_PUSH_MS
    if (head !== poll.head || isPushSettled || now - poll.pipelineAt >= interval) {
      poll.head = head
      poll.pipelineAt = now
      poll.pushedAt = 0
      poll.pipe = await fetchPipeline($, poll.root).catch(() => null)
    }
    const served = await servedHere($, poll, serveProcesses(ps.stdout)).catch(() => [])
    const right = joined([served.length > 0 ? [dim(`▶ ${served.join(' ')}`)] : [], poll.pipe ? pipeline(poll.pipe) : []], ' · ')
    await update($, nxLine, () => (middle.length > 0 || right.length > 0 ? { middle, right } : null))
  } finally {
    poll.isBusy = false
  }
}

function startTick($: EngineInterface, poll: Poll): void {
  void tick($, poll).catch((error: unknown) => $.ui.log(`usage-percent: ${String(error)}`, { to: 'debug' }))
}

export const register: Register = on => {
  let poll: Poll | null = null
  let timer: Timer | null = null
  const usage: Usage = { context: {} as SessionContextUsage, rateLimits: [], scoped: [], scopedAt: 0, isFetching: false }

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const { context, rateLimits } = await $.session.usage()
    Object.assign(usage, { context, rateLimits })
    await redraw($, usage)
    startRefresh($, usage)

    timer?.cancel()
    timer = null
    poll = null
    const root = await $.session.root()
    if (await $.fs.exists(`${root}/nx.json`)) {
      const uid = (await $.process.run(['id', '-u'])).stdout.trim()
      const current: Poll = { root, uid, head: '', pipelineAt: 0, pushedAt: 0, pipe: null, composeDirs: new Map(), isBusy: false }
      poll = current
      startTick($, current)
      timer = $.clock.every(TICK_MS, () => startTick($, current))
    }
    return result
  })

  on('session.measure', async ($, e, next) => {
    Object.assign(usage, { context: e.context, rateLimits: e.rateLimits })
    await redraw($, usage)
    startRefresh($, usage)
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)
    if (poll !== null && isGitPush(e.command)) {
      poll.pushedAt = await $.clock.now()
    }
    return result
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const left = (await read($, usageLine)) ?? []
    const nx = await read($, nxLine)
    const hint = await next(e)
    if (left.length === 0 && nx === null) {
      return hint
    }

    const { Box, Text } = $.ui.resolve(e)
    const draw = (pieces: readonly Piece[]) => (
      <Text>
        {pieces.map(piece => (piece.tone === 'dim' ? <Text dimColor>{piece.text}</Text> : <Text color={piece.tone}>{piece.text}</Text>))}
      </Text>
    )

    // Equal-width outer zones keep the memory zone centred.
    return (
      <Box flexDirection="column">
        {hint}
        <Box>
          <Box width={0} flexGrow={1}>{draw(left)}</Box>
          {nx && nx.middle.length > 0 ? <Box>{draw(nx.middle)}</Box> : null}
          <Box width={0} flexGrow={1} justifyContent="flex-end">{draw(nx?.right ?? [])}</Box>
        </Box>
      </Box>
    )
  })
}
