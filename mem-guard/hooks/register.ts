import type { EngineInterface, Register } from 'claude-code'

import { crowdedRefusal, invocations, isHeavy, parsePressure, refusal, scoped } from './rules'
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
    }
    return next({ ...e, command: scoped(e.command) })
  })
}
