import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionRateLimit } from 'claude-code'

import { containerOf, directoriesOf, isUnder, memory, pressureAvg10, servedIn, serveProcesses } from './machine'
import type { ServeProcess } from './machine'
import { dim, joined, toneOf } from './pieces'
import { forgeOf, hostOf, githubPipeline, gitlabPipeline, pipeline } from './pipeline'
import type { Pipeline } from './pipeline'
import type { Piece, Tone } from '../types'

const WINDOWS: Record<string, string> = { five_hour: '5h', seven_day: 'wk' }
const TICK_MS = 10_000
const PIPELINE_RUNNING_MS = 60_000
const PIPELINE_IDLE_MS = 300_000
const AFTER_PUSH_MS = 15_000
const COLORS: Record<Exclude<Tone, 'dim'>, string> = { yellow: 'yellow', red: 'red', green: 'green' }

const usageLine = atom({ plugin: 'usage-percent', key: 'line' } as const, null)
const nxLine = atom({ plugin: 'usage-percent', key: 'nx' } as const, null)

type Poll = { root: string; uid: string; head: string; pipelineAt: number; pushedAt: number; pipe: Pipeline | null; composeDirs: Map<string, string>; isBusy: boolean }

function figure(label: string, percent: number): Piece[] {
  return [dim(`${label} `), { text: `${Math.round(percent)}%`, tone: toneOf(percent) }]
}

export function line(context: SessionContextUsage, rateLimits: readonly SessionRateLimit[]): Piece[] {
  const limits = rateLimits.flatMap(limit => {
    const label = WINDOWS[limit.kind]
    return label === undefined ? [] : [figure(label, limit.percentUsed)]
  })
  return joined([figure('ctx', context.percent ?? 0), ...limits], ' | ')
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

export const register: Register = on => {
  let poll: Poll | null = null

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const { context, rateLimits } = await $.session.usage()
    await update($, usageLine, () => line(context, rateLimits))

    const root = await $.session.root()
    if (await $.fs.exists(`${root}/nx.json`)) {
      const uid = (await $.process.run(['id', '-u'])).stdout.trim()
      const current: Poll = { root, uid, head: '', pipelineAt: 0, pushedAt: 0, pipe: null, composeDirs: new Map(), isBusy: false }
      poll = current
      void tick($, current)
      $.clock.every(TICK_MS, () => void tick($, current))
    }
    return result
  })

  on('session.measure', async ($, e, next) => {
    await update($, usageLine, () => line(e.context, e.rateLimits))
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)
    if (poll !== null && /\bgit push\b/.test(e.command)) {
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
        {pieces.map(piece => (piece.tone === 'dim' ? <Text dimColor>{piece.text}</Text> : <Text color={COLORS[piece.tone]}>{piece.text}</Text>))}
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
