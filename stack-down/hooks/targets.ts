export type Proc = { pid: number; ppid: number; args: string }

const NX = /(^|[\s/])nx(\.js)?(\s|$)/
const CLAUDE = /^\S*\bclaude(\s|$)/

/** `ps -eo pid=,ppid=,args=` as rows. */
export const parsePs = (out: string): Proc[] =>
  out
    .split('\n')
    .map(line => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map(([, pid, ppid, args]) => ({ pid: Number(pid), ppid: Number(ppid), args: args ?? '' }))

export const isNx = (proc: Proc): boolean => NX.test(proc.args)

export const isClaude = (proc: Proc): boolean => CLAUDE.test(proc.args) && !proc.args.includes('--chrome-native-host')

/** The session's own Claude process: the nearest Claude among `pid` and its ancestors, else `pid` itself. */
export const sessionOf = (procs: Proc[], pid: number): number => {
  const byPid = new Map(procs.map(proc => [proc.pid, proc]))
  for (let proc = byPid.get(pid); proc; proc = byPid.get(proc.ppid)) {
    if (isClaude(proc)) {
      return proc.pid
    }
    if (proc.ppid === proc.pid) {
      break
    }
  }
  return pid
}

/** The nx processes the session started, with everything they started in turn. */
export const nxOf = (procs: Proc[], session: number): number[] => {
  const mine = new Set(withDescendants(procs, [session]))
  return withDescendants(procs, procs.filter(proc => mine.has(proc.pid) && isNx(proc)).map(proc => proc.pid))
}

/** Whether a Claude process other than this session works inside the repo, so its Compose stacks stay up. */
export const othersIn = (claudes: { pid: number; cwd: string }[], session: number, root: string): boolean =>
  claudes.some(claude => claude.pid !== session && inside(claude.cwd, root))

/** The given processes and everything they started, so a server's workers go with it. */
export const withDescendants = (procs: Proc[], roots: number[]): number[] => {
  const children = new Map<number, number[]>()
  for (const { pid, ppid } of procs) {
    children.set(ppid, [...(children.get(ppid) ?? []), pid])
  }
  const found = new Set<number>()
  const queue = [...roots]
  while (queue.length > 0) {
    const pid = queue.pop() as number
    if (found.has(pid)) {
      continue
    }
    found.add(pid)
    queue.push(...(children.get(pid) ?? []))
  }
  return [...found]
}

export const inside = (dir: string, root: string): boolean =>
  dir === root || dir.startsWith(`${root}/`)

export type ComposeProject = { Name: string; ConfigFiles: string }

/** The Compose projects whose files live in the repo; `ConfigFiles` lists them comma-separated. */
export const composeIn = (projects: ComposeProject[], root: string): string[] =>
  projects
    .filter(project => project.ConfigFiles.split(',').some(file => inside(file.trim(), root)))
    .map(project => project.Name)

/**
 * Only a session at a repo's top level owns what is inside it: one in `~/Dev` would otherwise take
 * down every project below. `toplevel` is `git rev-parse --show-toplevel` run in the root.
 */
export const isRepoRoot = (toplevel: { exitCode: number; stdout: string }, root: string): boolean =>
  toplevel.exitCode === 0 && toplevel.stdout.trim() === root
