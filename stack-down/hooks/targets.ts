export type Proc = { pid: number; ppid: number; args: string }

const NX = /(^|[\s/])nx(\.js)?(\s|$)/

/** `ps -eo pid=,ppid=,args=` as rows. */
export const parsePs = (out: string): Proc[] =>
  out
    .split('\n')
    .map(line => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map(([, pid, ppid, args]) => ({ pid: Number(pid), ppid: Number(ppid), args: args ?? '' }))

export const isNx = (proc: Proc): boolean => NX.test(proc.args)

/** The given processes and everything they started, so a server's workers go with it. */
export const withDescendants = (procs: Proc[], roots: number[]): number[] => {
  const children = new Map<number, number[]>()
  for (const { pid, ppid } of procs) children.set(ppid, [...(children.get(ppid) ?? []), pid])
  const found = new Set<number>()
  const queue = [...roots]
  while (queue.length > 0) {
    const pid = queue.pop() as number
    if (found.has(pid)) continue
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
