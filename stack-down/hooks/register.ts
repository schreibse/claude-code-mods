import type { Register } from 'claude-code'
import { composeIn, inside, isNx, isRepoRoot, parsePs, withDescendants } from './targets'

const ENDS = new Set(['clear', 'prompt_input_exit', 'logout', 'other'])

/** Whatever the session's repo left running ends with the session: its nx processes and its Compose stacks. */
export const register: Register = on => {
  on('session.end', async ($, e, next) => {
    if (!ENDS.has(e.reason)) return next(e)
    const root = await $.session.root()

    try {
      if (!isRepoRoot(await $.process.run(['git', '-C', root, 'rev-parse', '--show-toplevel']), root)) {
        $.ui.log(`stack-down: ${root} is no repo's top level, nothing stopped`, { to: 'debug' })
        return next(e)
      }

      const procs = parsePs((await $.process.run(['ps', '-eo', 'pid=,ppid=,args='])).stdout)
      const nx = []
      for (const proc of procs.filter(isNx)) {
        const cwd = await $.process.run(['readlink', `/proc/${proc.pid}/cwd`])
        if (cwd.exitCode === 0 && inside(cwd.stdout.trim(), root)) nx.push(proc.pid)
      }
      const pids = withDescendants(procs, nx)
      if (pids.length > 0) await $.process.run(['kill', '-TERM', ...pids.map(String)])

      const ls = await $.process.run(['docker', 'compose', 'ls', '-a', '--format', 'json'])
      const stacks = ls.exitCode === 0 ? composeIn(JSON.parse(ls.stdout || '[]'), root) : []
      for (const name of stacks) {
        // Detached, so the exit's short bound cannot cut Compose off halfway.
        await $.process.run(['setsid', '-f', 'sh', '-c', `docker compose -p '${name}' down >/dev/null 2>&1`])
      }
      $.ui.log(`stack-down: ${root}: ${nx.length} nx process(es) stopped, down: ${stacks.join(', ') || 'none'}`, { to: 'debug' })
    } catch (error) {
      $.ui.log(`stack-down: ${String(error)}`, { to: 'debug' })
    }
    return next(e)
  })
}
