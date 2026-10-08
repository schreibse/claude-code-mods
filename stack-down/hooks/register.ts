import type { Register } from 'claude-code'
import { composeIn, isClaude, isRepoRoot, nxOf, othersIn, parsePs, sessionOf } from './targets'

const ENDS = new Set(['clear', 'prompt_input_exit', 'logout', 'other'])

/** What the session left running ends with it: the nx processes it started, and its repo's Compose stacks once no other session works there. */
export const register: Register = on => {
  on('session.end', async ($, e, next) => {
    if (!ENDS.has(e.reason)) {
      return next(e)
    }
    const root = await $.session.root()

    try {
      if (!isRepoRoot(await $.process.run(['git', '-C', root, 'rev-parse', '--show-toplevel']), root)) {
        $.ui.log(`stack-down: ${root} is no repo's top level, nothing stopped`, { to: 'debug' })
        return next(e)
      }

      const procs = parsePs((await $.process.run(['ps', '-eo', 'pid=,ppid=,args='])).stdout)
      const session = sessionOf(procs, Number((await $.process.run(['sh', '-c', 'echo $PPID'])).stdout.trim()))
      const pids = nxOf(procs, session)
      if (pids.length > 0) {
        await $.process.run(['kill', '-TERM', ...pids.map(String)])
      }

      const claudes = []
      for (const proc of procs.filter(isClaude)) {
        const cwd = await $.process.run(['readlink', `/proc/${proc.pid}/cwd`])
        if (cwd.exitCode === 0) {
          claudes.push({ pid: proc.pid, cwd: cwd.stdout.trim() })
        }
      }
      const ls = othersIn(claudes, session, root) ? undefined : await $.process.run(['docker', 'compose', 'ls', '-a', '--format', 'json'])
      const stacks = ls?.exitCode === 0 ? composeIn(JSON.parse(ls.stdout || '[]'), root) : []
      for (const name of stacks) {
        // Detached, so the exit's short bound cannot cut Compose off halfway.
        await $.process.run(['setsid', '-f', 'sh', '-c', `docker compose -p '${name}' down >/dev/null 2>&1`])
      }
      const down = ls ? stacks.join(', ') || 'none' : 'none, another session works here'
      $.ui.log(`stack-down: ${root}: ${pids.length} nx process(es) stopped, down: ${down}`, { to: 'debug' })
    } catch (error) {
      $.ui.log(`stack-down: ${String(error)}`, { to: 'debug' })
    }
    return next(e)
  })
}
