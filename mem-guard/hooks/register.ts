import type { EngineInterface, Register } from 'claude-code'

import { checkRunnerRefusal, crowdedRefusal, drivesPlaywright, escapeRefusal, invocations, isHeavy, isServe, machineRefusal, nodeScripts, parseMeminfo, parsePressure, PS_COMMAND, refusal, runningRefusal, runsSandboxed, scoped, withServeElsewhere } from './rules'
import type { Invocation, Pressure, ScriptsByDir } from './rules'

const DOCKER_SLICE = 'docker.slice'
// A system slice, so its path is fixed; absent or uncapped it reads as no pressure.
const sliceDirs = new Map<string, string>([[DOCKER_SLICE, '/sys/fs/cgroup/docker.slice']])
let home = ''

const CMD_SLICE = 'claude-cmd.slice'
const SESSIONS_SLICE = 'claude.slice'

// Not cached while the slice is inactive, so it is looked up again on the next call.
async function resolveSlice($: EngineInterface, name: string): Promise<string> {
  if (!sliceDirs.has(name)) {
    const group = await $.process.run(['systemctl', '--user', 'show', name, '-p', 'ControlGroup', '--value']).catch(() => null)
    const path = group?.exitCode === 0 ? group.stdout.trim() : ''
    if (path !== '') {
      sliceDirs.set(name, `/sys/fs/cgroup${path}`)
    }
  }
  return sliceDirs.get(name) ?? ''
}

// The sessions' slice is measured against MemoryHigh, where throttling starts; the command slice against its MemoryMax.
async function readPressure($: EngineInterface, name: string): Promise<Pressure | null> {
  const slice = await resolveSlice($, name)
  if (slice === '') {
    return null
  }
  const read = (file: string) => $.fs.read(`${slice}/${file}`)
  const limitFile = name === SESSIONS_SLICE ? 'memory.high' : 'memory.max'
  const [current, max, pressure] = await Promise.all([read('memory.current'), read(limitFile), read('memory.pressure')]).catch(() => ['', '', ''])
  return parsePressure(current ?? '', max ?? '', pressure ?? '')
}

async function crowdedSlice($: EngineInterface): Promise<string | null> {
  for (const name of [CMD_SLICE, SESSIONS_SLICE, DOCKER_SLICE]) {
    const pressure = await readPressure($, name)
    const crowded = pressure === null ? null : crowdedRefusal(pressure, name)
    if (crowded !== null) {
      return crowded
    }
  }
  return null
}

async function shortMachine($: EngineInterface): Promise<string | null> {
  const machine = parseMeminfo((await $.fs.read('/proc/meminfo').catch(() => '')) ?? '')
  return machine === null ? null : machineRefusal(machine)
}

async function scriptsIn($: EngineInterface, dir: string): Promise<Record<string, string>> {
  const manifest = await $.fs.read(`${dir}/package.json`).catch(() => '{}')
  try {
    return (JSON.parse(manifest) as { scripts?: Record<string, string> }).scripts ?? {}
  } catch {
    return {}
  }
}

async function scriptsOf($: EngineInterface, calls: readonly Invocation[]): Promise<ScriptsByDir> {
  const dirs = [...new Set(calls.map(call => call.dir))]
  const scripts = await Promise.all(dirs.map(dir => scriptsIn($, dir)))
  return Object.fromEntries(dirs.map((dir, i) => [dir, scripts[i] ?? {}]))
}

async function runsPlaywrightScript($: EngineInterface, calls: readonly Invocation[]): Promise<boolean> {
  const sources = await Promise.all(nodeScripts(calls, home).map(file => $.fs.read(file).catch(() => '')))
  return sources.some(source => drivesPlaywright(source ?? ''))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await resolveSlice($, CMD_SLICE)
    home = (await $.env.get('HOME')) ?? ''
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (e.agentId !== undefined) {
      const agents = await $.agent.list().catch(() => [])
      if (agents.find(agent => agent.id === e.agentId)?.type === 'check-runner') {
        const writeRefusal = checkRunnerRefusal(e.command)
        if (writeRefusal !== null) {
          return { deny: `mem-guard: ${writeRefusal}` }
        }
      }
    }
    const calls = invocations(e.command, { cwd: await $.session.cwd(), home })
    const refused = escapeRefusal(e.command) ?? refusal(calls, await scriptsOf($, calls))
    if (refused !== null) {
      return { deny: `mem-guard: ${refused}` }
    }
    if (isHeavy(calls) || isServe(calls) || (await runsPlaywrightScript($, calls))) {
      const crowded = (await crowdedSlice($)) ?? (await shortMachine($))
      if (crowded !== null) {
        return { deny: `mem-guard: ${withServeElsewhere(calls, crowded)}` }
      }
      const ps = await $.process.run(PS_COMMAND).catch(() => null)
      const busyRefusal = ps?.exitCode === 0 ? runningRefusal(calls, ps.stdout) : null
      if (busyRefusal !== null) {
        return { deny: `mem-guard: ${withServeElsewhere(calls, busyRefusal)}` }
      }
    }
    const scopedCommand = scoped(e.command)
    if (scopedCommand === e.command) {
      return next(e)
    }
    const sandbox = await $.settings.read({ key: 'sandbox' }).catch(() => undefined)
    return runsSandboxed(sandbox, e.dangerouslyDisableSandbox) ? next(e) : next({ ...e, command: scopedCommand })
  })
}
