import type { EngineInterface, Register } from 'claude-code'

import { checkRunnerRefusal, concurrencyRefusal, crowdedRefusal, heavyScopes, invocations, isHeavy, isServe, parsePressure, refusal, scoped, serveRefusal, serveScopes } from './rules'
import type { Invocation, Pressure, ScriptsByDir } from './rules'

let cmdSlice = ''
let home = ''

async function readPressure($: EngineInterface): Promise<Pressure | null> {
  if (cmdSlice === '') {
    return null
  }
  const read = (file: string) => $.fs.read(`${cmdSlice}/${file}`)
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
    const group = await $.process.run(['systemctl', '--user', 'show', 'claude-cmd.slice', '-p', 'ControlGroup', '--value']).catch(() => null)
    const path = group?.exitCode === 0 ? group.stdout.trim() : ''
    cmdSlice = path === '' ? '' : `/sys/fs/cgroup${path}`
    home = (await $.env.get('HOME')) ?? ''
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (e.agentId !== undefined) {
      const agents = await $.agent.list().catch(() => [])
      if (agents.find(agent => agent.id === e.agentId)?.type === 'check-runner') {
        const writes = checkRunnerRefusal(e.command)
        if (writes !== null) {
          return { deny: `mem-guard: ${writes}` }
        }
      }
    }
    const calls = invocations(e.command, { cwd: await $.session.cwd(), home })
    const refused = refusal(calls, await scriptsOf($, calls))
    if (refused !== null) {
      return { deny: `mem-guard: ${refused}` }
    }
    if (isHeavy(calls)) {
      const pressure = await readPressure($)
      const crowded = pressure === null ? null : crowdedRefusal(pressure)
      if (crowded !== null) {
        return { deny: `mem-guard: ${crowded}` }
      }
      const ps = await $.process.run(['ps', '-eo', 'cgroup:250=,args=', '--cols', '600']).catch(() => null)
      const servers = ps?.exitCode === 0 && isServe(calls) ? serveRefusal(serveScopes(ps.stdout)) : null
      if (servers !== null) {
        return { deny: `mem-guard: ${servers}` }
      }
      const busy = ps?.exitCode === 0 ? concurrencyRefusal(heavyScopes(ps.stdout)) : null
      if (busy !== null) {
        return { deny: `mem-guard: ${busy}` }
      }
    }
    return next({ ...e, command: scoped(e.command) })
  })
}
