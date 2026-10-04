import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionRateLimit } from 'claude-code'

import { memory, pressureAvg10, servedProjects } from './machine'
import { forgeOf, hostOf, githubPipeline, gitlabPipeline, pipeline } from './pipeline'
import type { Pipeline } from './pipeline'

const WINDOWS: Record<string, string> = { five_hour: '5h', seven_day: 'wk' }
const TICK_MS = 10_000
const PIPELINE_RUNNING_MS = 60_000
const PIPELINE_IDLE_MS = 300_000
const AFTER_PUSH_MS = 15_000
const SECTION_GAP = '  |  '

const usageLine = atom({ plugin: 'usage-percent', key: 'line' } as const, null)
const nxLine = atom({ plugin: 'usage-percent', key: 'nx' } as const, null)

type Poll = { root: string; uid: string; head: string; pipelineAt: number; pushedAt: number; pipe: Pipeline | null; isBusy: boolean }

function figure(label: string, percent: number): string {
  const marker = percent >= 95 ? '✖' : percent >= 80 ? '▲' : ''
  return `${label} ${Math.round(percent)}%${marker}`
}

export function line(context: SessionContextUsage, rateLimits: readonly SessionRateLimit[]): string {
  const limits = rateLimits.flatMap(limit => {
    const label = WINDOWS[limit.kind]
    return label === undefined ? [] : [figure(label, limit.percentUsed)]
  })
  return [figure('ctx', context.percent ?? 0), ...limits].join(' | ')
}

async function memoryText($: EngineInterface, uid: string): Promise<string> {
  const service = `/sys/fs/cgroup/user.slice/user-${uid}.slice/user@${uid}.service`
  const files = ['claude.slice/memory.current', 'claude.slice/memory.max', 'app.slice/memory.pressure']
  const contents = await Promise.all(files.map(file => $.fs.read(`${service}/${file}`))).catch(() => null)
  if (contents === null) {
    return ''
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

// Memory and servers every tick; the pipeline only when HEAD moved, after a push, or when its interval is up.
async function tick($: EngineInterface, poll: Poll) {
  if (poll.isBusy) {
    return
  }
  poll.isBusy = true
  try {
    const [mem, ps, head] = await Promise.all([
      memoryText($, poll.uid),
      $.process.run(['ps', '-eo', 'args']),
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
    const served = servedProjects(ps.stdout)
    const parts = [mem, served.length > 0 ? `serve ${served.join(' ')}` : '', poll.pipe ? pipeline(poll.pipe) : '']
    const text = parts.filter(Boolean).join(SECTION_GAP)
    await update($, nxLine, () => text || null)
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
      const current: Poll = { root, uid, head: '', pipelineAt: 0, pushedAt: 0, pipe: null, isBusy: false }
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
    const text = [await read($, usageLine), await read($, nxLine)].filter(Boolean).join(SECTION_GAP)
    const hint = await next(e)
    if (text === '') {
      return hint
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {hint}
        <Text dimColor>{text}</Text>
      </Box>
    )
  })
}
