import type { EngineInterface, Register } from 'claude-code'

import { checkRunnerRefusal, crowdedRefusal, invocations, isHeavy, isServe, parsePressure, refusal, runningRefusal, scoped } from './rules'
import type { Invocation, Pressure, ScriptsByDir } from './rules'

let cmdSlice = ''
let home = ''

// Stays empty while claude-cmd.slice is inactive, so it is looked up again on the next call.
async function resolveCmdSlice($: EngineInterface): Promise<string> {
  if (cmdSlice === '') {
    const group = await $.process.run(['systemctl', '--user', 'show', 'claude-cmd.slice', '-p', 'ControlGroup', '--value']).catch(() => null)
    const path = group?.exitCode === 0 ? group.stdout.trim() : ''
    cmdSlice = path === '' ? '' : `/sys/fs/cgroup${path}`
  }
  return cmdSlice
}

async function readPressure($: EngineInterface): Promise<Pressure | null> {
  const slice = await resolveCmdSlice($)
  if (slice === '') {
    return null
  }
  const read = (file: string) => $.fs.read(`${slice}/${file}`)
  const [current, max, pressure] = await Promise.all([read('memory.current'), read('memory.max'), read('memory.pressure')]).catch(() => ['', '', ''])
  return parsePressure(current ?? '', max ?? '', pressure ?? '')
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await resolveCmdSlice($)
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
    const refused = refusal(calls, await scriptsOf($, calls))
    if (refused !== null) {
      return { deny: `mem-guard: ${refused}` }
    }
    if (isHeavy(calls) || isServe(calls)) {
      const pressure = await readPressure($)
      const crowded = pressure === null ? null : crowdedRefusal(pressure)
      if (crowded !== null) {
        return { deny: `mem-guard: ${crowded}` }
      }
      const ps = await $.process.run(['ps', '-eo', 'cgroup:250=,args=', '--cols', '600']).catch(() => null)
      const busyRefusal = ps?.exitCode === 0 ? runningRefusal(calls, ps.stdout) : null
      if (busyRefusal !== null) {
        return { deny: `mem-guard: ${busyRefusal}` }
      }
    }
    return next({ ...e, command: scoped(e.command) })
  })
}
