import type { Progress, Task } from '../types'

export const BAR_WIDTH = 10
export const FOREGROUND_DELAY_MS = 5_000
export const MIN_LABEL_WIDTH = 16
/** Icon and kind before the label, and the table after it: bar, progress, memory, time with their gaps. */
export const PREFIX_WIDTH = 8
export const TABLE_WIDTH = BAR_WIDTH + 2 + 8 + 2 + 5 + 2 + 5
/** Between the label column and the table, as usage-percent's reset gap. */
export const LABEL_GAP = 8

export type ProcessRow = { pid: number; ppid: number; rssKb: number; args: string }

/** `ps -ww -eo pid=,ppid=,rss=,args=` */
export function parsePs(stdout: string): ProcessRow[] {
  return stdout.split('\n').flatMap(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line)
    return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), rssKb: Number(match[3]), args: match[4] ?? '' }] : []
  })
}

/** The shells Claude Code started for Bash calls; probes like this mod's own are not among them. */
export function toolShells(rows: readonly ProcessRow[], claudePid: number): ProcessRow[] {
  return rows.filter(row => row.ppid === claudePid && row.args.includes('shell-snapshots/snapshot-'))
}

export function treeRssKb(rows: readonly ProcessRow[], root: number): number {
  const children = new Map<number, ProcessRow[]>()
  for (const row of rows) {
    children.set(row.ppid, [...(children.get(row.ppid) ?? []), row])
  }
  let total = 0
  const stack = rows.filter(row => row.pid === root)
  while (stack.length > 0) {
    const row = stack.pop()!
    total += row.rssKb
    stack.push(...(children.get(row.pid) ?? []))
  }
  return total
}

export function backgroundIdOf(stdoutLink: string): string | null {
  return /\/tasks\/([^/]+)\.output$/.exec(stdoutLink.trim())?.[1] ?? null
}

/** Whether a tool shell's argv runs `command`, as Claude Code quotes it into `eval '…'`. */
export function runsCommand(args: string, command: string): boolean {
  const quoted = command.replace(/'/g, `'\\''`)
  return args.includes(`eval '${quoted.slice(0, 200)}`)
}

/**
 * Pairs running foreground shell calls with their processes: by command text first, then the single
 * call and process left over (a hook beneath may have rewritten the command).
 */
export function pairForeground(calls: readonly Task[], shells: readonly ProcessRow[]): Map<string, number> {
  const pairs = new Map<string, number>()
  const taken = new Set<number>()
  for (const call of calls) {
    const shell = shells.find(row => !taken.has(row.pid) && call.command !== undefined && runsCommand(row.args, call.command))
    if (shell) {
      pairs.set(call.key, shell.pid)
      taken.add(shell.pid)
    }
  }
  const restCalls = calls.filter(call => !pairs.has(call.key))
  const restShells = shells.filter(row => !taken.has(row.pid))
  if (restCalls.length === 1 && restShells.length === 1) {
    pairs.set(restCalls[0]!.key, restShells[0]!.pid)
  }
  return pairs
}

const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g

/** Progress a command printed: an nx task count, a `[N/M]` counter, or a percentage near the end. */
export function progressOf(output: string): Progress | undefined {
  const text = output.replace(ANSI, '').replace(/\r/g, '\n')
  const nxRuns = [...text.matchAll(/Running targets? .* for (\d+) projects?/g)]
  const nxTotal = Number(nxRuns.at(-1)?.[1] ?? 0)
  if (nxTotal > 0) {
    const afterStart = text.slice(nxRuns.at(-1)!.index)
    const done = (afterStart.match(/^\s*[✔✖]\s+nx run /gm) ?? []).length
    return { done: Math.min(done, nxTotal), total: nxTotal, unit: 'proj' }
  }
  const lines = text.split('\n').filter(line => line.trim() !== '')
  const recent = lines.slice(-5).join('\n')
  const counter = [...recent.matchAll(/\[(\d+)\/(\d+)\]/g)].at(-1)
  if (counter) {
    const done = Number(counter[1])
    const total = Number(counter[2])
    if (total > 1 && done <= total) {
      return { done, total, unit: '' }
    }
  }
  const percent = [...lines.slice(-3).join('\n').matchAll(/(?<![\d.])(\d{1,3}(?:\.\d+)?)\s?%/g)].at(-1)
  if (percent && Number(percent[1]) <= 100) {
    return { percent: Number(percent[1]) }
  }
  return undefined
}

export function monitorProgress(task: Task, now: number): Progress | undefined {
  return task.timeoutMs ? { percent: Math.min(100, ((now - task.startedAt) / task.timeoutMs) * 100) } : undefined
}

export function fraction(progress: Progress): number {
  return 'percent' in progress ? progress.percent / 100 : progress.total === 0 ? 0 : progress.done / progress.total
}

/** A filled bar, or without progress one cell that walks once a second so a live task still looks alive. */
export function bar(progress: Progress | undefined, now: number): string {
  if (progress !== undefined) {
    const filled = Math.round(Math.min(1, fraction(progress)) * BAR_WIDTH)
    return '▰'.repeat(filled) + '▱'.repeat(BAR_WIDTH - filled)
  }
  const at = Math.floor(now / 1000) % BAR_WIDTH
  return '▱'.repeat(at) + '▰' + '▱'.repeat(BAR_WIDTH - 1 - at)
}

export function progressText(task: Task): string {
  const progress = task.progress
  if (progress === undefined) {
    return task.tools ? `⚒ ${task.tools}` : ''
  }
  return 'percent' in progress ? `${Math.floor(progress.percent)}%` : `${progress.done}/${progress.total}${progress.unit ? ` ${progress.unit}` : ''}`
}

export function memText(kb: number | undefined): string {
  if (kb === undefined || kb === 0) {
    return '—'
  }
  const mb = kb / 1024
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}G` : `${Math.round(mb)}M`
}

export function memTone(kb: number | undefined): 'red' | 'yellow' | undefined {
  const gb = (kb ?? 0) / 1024 / 1024
  return gb >= 4 ? 'red' : gb >= 2 ? 'yellow' : undefined
}

export function duration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`
}

/** The label cut at a word boundary to `width`, padded to it so the table after it lines up. */
export function fit(text: string, width: number): string {
  const line = text.split('\n')[0]?.trim() ?? ''
  if (line.length <= width) {
    return line.padEnd(width)
  }
  const head = line.slice(0, width - 1)
  const cut = head.lastIndexOf(' ')
  return `${cut >= Math.floor(width / 2) ? head.slice(0, cut) : head}…`.padEnd(width)
}

/** The label column is as wide as the longest label shown, within what the width leaves for it. */
export function labelWidth(bodyColumns: number, labels: readonly string[]): number {
  const available = Math.max(MIN_LABEL_WIDTH, bodyColumns - 2 - PREFIX_WIDTH - LABEL_GAP - TABLE_WIDTH)
  const longest = Math.max(1, ...labels.map(label => label.split('\n')[0]?.trim().length ?? 0))
  return Math.min(available, longest)
}

const KIND_LABEL: Record<Task['kind'], string> = { shell: 'shell', agent: 'agent', workflow: 'wflow', monitor: 'watch' }

export function kindText(task: Task): string {
  return KIND_LABEL[task.kind].padEnd(5)
}

/** Rows in display order: an agent's foreground shells follow their agent, as its children. */
export function treeOrder(tasks: readonly Task[]): { task: Task; isChild: boolean }[] {
  const agentIds = new Set(tasks.flatMap(t => (t.kind === 'agent' && t.taskId ? [t.taskId] : [])))
  const isChildOf = (t: Task) => t.kind === 'shell' && t.agentId !== undefined && agentIds.has(t.agentId)
  return tasks.filter(t => !isChildOf(t)).flatMap(parent => [
    { task: parent, isChild: false },
    ...tasks.filter(t => isChildOf(t) && t.agentId === parent.taskId).map(task => ({ task, isChild: true })),
  ])
}

export function isShown(task: Task, now: number): boolean {
  return task.isBackground || task.kind !== 'shell' || now - task.startedAt >= FOREGROUND_DELAY_MS
}
