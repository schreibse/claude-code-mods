import { dim } from './pieces'
import type { Piece } from '../types'

export type Pipeline = { state: 'running' | 'passed' | 'manual' | 'failed' | 'no-login'; detail: string }
export type Forge = 'github' | 'gitlab'

export function hostOf(remoteUrl: string): string {
  return /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)/i.exec(remoteUrl.trim())?.[1] ?? ''
}

export function forgeOf(remoteUrl: string): Forge | null {
  if (remoteUrl.trim() === '') {
    return null
  }
  if (/(^|[@/.])(dev\.azure|visualstudio)\.com[:/]/.test(remoteUrl)) {
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
    case 'canceled':
      return { state: 'failed', detail: '' }
    case 'success':
      return { state: 'passed', detail: '' }
    case 'manual':
      return { state: 'manual', detail: '' }
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
  if (run.status === 'waiting' || run.status === 'pending' || run.status === 'action_required' || run.conclusion === 'action_required') {
    return { state: 'manual', detail: run.workflowName ?? '' }
  }
  if (run.status !== 'completed') {
    return { state: 'running', detail: run.workflowName ?? '' }
  }
  if (run.conclusion === 'success' || run.conclusion === 'skipped' || run.conclusion === 'neutral') {
    return { state: 'passed', detail: '' }
  }
  return { state: 'failed', detail: run.workflowName ?? '' }
}

export function pipeline(p: Pipeline): Piece[] {
  if (p.state === 'no-login') {
    return [dim(`ci no login (${p.detail})`)]
  }
  const glyph = { running: '⏳', passed: '✓', manual: '⏸', failed: '✗' }[p.state]
  const tone = p.state === 'failed' ? 'red' : p.state === 'passed' ? 'green' : 'dim'
  const detail = p.detail.toLowerCase() === 'ci' ? '' : p.detail
  return [dim('ci '), { text: detail === '' ? glyph : `${glyph} ${detail}`, tone }]
}
