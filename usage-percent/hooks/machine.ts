import { dim, toneOf } from './pieces'
import type { Piece } from '../types'

const GIB = 1024 ** 3

export type ServeProcess = { pid: string; project: string }

export function memory(current: number, max: number, pressureAvg10: number): Piece[] {
  const used = { text: `${(current / GIB).toFixed(1)}G`, tone: Number.isFinite(max) ? toneOf((current / max) * 100) : 'dim' } as const
  if (pressureAvg10 <= 0) {
    return [dim('mem '), used]
  }
  return [dim('mem '), used, dim(' psi '), { text: `${Math.round(pressureAvg10)}%`, tone: toneOf(pressureAvg10, 20, 50) }]
}

export function pressureAvg10(pressureFile: string): number {
  return Number(/^some avg10=([\d.]+)/m.exec(pressureFile)?.[1] ?? 0)
}

// From `ps -eo pid,args`. A server of nx's default project, or of every project, shows as plain `serve`.
export function serveProcesses(ps: string): ServeProcess[] {
  return [...ps.matchAll(/^\s*(\d+)\s.*?\bnx (.*)$/gm)].flatMap(m => servedProjects(m[2] ?? '').map(project => ({ pid: m[1] ?? '', project })))
}

function servedProjects(args: string): string[] {
  const run = /^run ([\w.-]+):serve(?=[:\s]|$)/.exec(args)
  if (run) {
    return [run[1] ?? '']
  }
  const serve = /^serve(?=\s|$)(.*)/.exec(args)
  if (serve) {
    return [optionOf(serve[1] ?? '', 'project', 'p') ?? /^\s+(\w[\w.-]*)/.exec(serve[1] ?? '')?.[1] ?? 'serve']
  }
  if (/^run-many\b/.test(args) && /(?:^|,)serve(?:,|$)/.test(optionOf(args, 'targets', 't') ?? optionOf(args, 'target') ?? '')) {
    return (optionOf(args, 'projects', 'p') ?? 'serve').split(',')
  }
  return []
}

function optionOf(args: string, name: string, short?: string): string | null {
  const flag = short === undefined ? `--${name}` : `(?:--${name}|-${short})`
  return new RegExp(`(?:^|\\s)${flag}(?:=|\\s+)([^\\s-][^\\s]*)`).exec(args)?.[1] ?? null
}

// From `pwdx <pid>...`: `1234: /dir` per line.
export function directoriesOf(pwdx: string): Map<string, string> {
  return new Map([...pwdx.matchAll(/^(\d+): (.+)$/gm)].map(m => [m[1] ?? '', m[2] ?? '']))
}

// From `/proc/<pid>/cgroup`: the Docker container the process runs in, if any.
export function containerOf(cgroup: string): string | null {
  return /\/docker-([0-9a-f]+)\.scope/.exec(cgroup)?.[1] ?? null
}

export function isUnder(dir: string, root: string): boolean {
  return dir === root || dir.startsWith(`${root}/`)
}

export function servedIn(root: string, processes: readonly ServeProcess[], dirOf: ReadonlyMap<string, string>): string[] {
  const names = processes.filter(p => isUnder(dirOf.get(p.pid) ?? '', root)).map(p => p.project)
  return [...new Set(names)].sort()
}
