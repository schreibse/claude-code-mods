export type Pipeline = { state: 'running' | 'passed' | 'failed' | 'no-login'; detail: string }
export type Forge = 'github' | 'gitlab'

const GIB = 1024 ** 3

export function memory(current: number, max: number, pressureAvg10: number): string {
  const used = Number.isFinite(max) ? `mem ${(current / GIB).toFixed(1)}/${Math.round(max / GIB)}G` : `mem ${(current / GIB).toFixed(1)}G`
  if (pressureAvg10 <= 0) {
    return used
  }
  return `${used} psi ${Math.round(pressureAvg10)}%${pressureAvg10 >= 50 ? '▲' : ''}`
}

export function pressureAvg10(pressureFile: string): number {
  return Number(/^some avg10=([\d.]+)/m.exec(pressureFile)?.[1] ?? 0)
}

export function servedProjects(psArgs: string): string[] {
  const names = [...psArgs.matchAll(/\bnx (?:serve ([\w.-]+)|run ([\w.-]+):serve\b)/g)].map(m => m[1] ?? m[2] ?? '')
  return [...new Set(names.filter(Boolean))].sort()
}

export function hostOf(remoteUrl: string): string {
  return /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)/i.exec(remoteUrl.trim())?.[1] ?? ''
}

export function forgeOf(remoteUrl: string): Forge | null {
  if (remoteUrl.trim() === '') {
    return null
  }
  return /(^|[@/])github\.com[:/]/.test(remoteUrl) ? 'github' : 'gitlab'
}

type GitlabJob = { name?: string; status?: string; stage?: string }

export function gitlabPipeline(json: string): Pipeline | null {
  const p = JSON.parse(json) as { status?: string; jobs?: GitlabJob[] }
  const jobs = p.jobs ?? []
  switch (p.status) {
    case 'running':
    case 'pending':
    case 'created':
    case 'preparing':
    case 'waiting_for_resource':
      return { state: 'running', detail: jobs.find(job => job.status === 'running')?.stage ?? '' }
    case 'failed':
      return { state: 'failed', detail: jobs.filter(job => job.status === 'failed').map(job => job.name ?? '').join(' ') }
    case 'success':
    case 'manual':
      return { state: 'passed', detail: '' }
    default:
      return null
  }
}

type GithubRun = { status?: string; conclusion?: string; workflowName?: string }

export function githubPipeline(json: string): Pipeline | null {
  const run = (JSON.parse(json) as GithubRun[])[0]
  if (run === undefined) {
    return null
  }
  if (run.status !== 'completed') {
    return { state: 'running', detail: run.workflowName ?? '' }
  }
  if (run.conclusion === 'success' || run.conclusion === 'skipped' || run.conclusion === 'neutral') {
    return { state: 'passed', detail: '' }
  }
  return { state: 'failed', detail: run.workflowName ?? '' }
}

export function pipeline(p: Pipeline): string {
  if (p.state === 'no-login') {
    return `pipe no login (${p.detail})`
  }
  const glyph = p.state === 'running' ? '⏳' : p.state === 'passed' ? '✓' : '✗'
  return `pipe ${glyph}${p.detail === '' ? '' : ` ${p.detail}`}`
}
