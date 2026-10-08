import type { Decision, Finding, Walk } from '../types'

type Reported = { file: string; line?: number; summary: string; short_summary?: string; category?: string; outcome?: string }

const BAR_WIDTH = 20
const SKILL = 'review-walk'

/** The skill as a user skill (`review-walk`) or as the plugin's (`review-walk:review-walk`). */
export function isWalkSkill(name: string | undefined): boolean {
  return name === SKILL || name === `${SKILL}:${SKILL}`
}

/** A report without outcomes starts a walk; one with outcomes is the closing report and ends it. */
export function walkFrom(reported: Reported[]): Walk | null {
  if (reported.length === 0 || reported.some(f => f.outcome !== undefined)) {
    return null
  }
  const findings: Finding[] = reported.map(f => ({
    where: f.line === undefined ? f.file : `${f.file}:${f.line}`,
    category: f.category ?? null,
    label: f.short_summary ?? f.summary,
  }))
  return { findings, asking: null, decisions: findings.map(() => null) }
}

/** The skill heads each finding's question `N/M`; anything else is not part of the walk. */
export function positionOf(header: string | undefined, walk: Walk | null): number | null {
  const match = /^(\d+)\/(\d+)$/.exec(header?.trim() ?? '')
  if (walk === null || match === null || Number(match[2]) !== walk.findings.length) {
    return null
  }
  const n = Number(match[1])
  return n >= 1 && n <= walk.findings.length ? n - 1 : null
}

/** Records decisions the user authorised without a question; the text says why when they cannot apply. */
export function decide(walk: Walk | null, findings: readonly number[], decision: Decision): Walk | string {
  if (walk === null) {
    return 'No review walk is active.'
  }
  const total = walk.findings.length
  const outside = findings.filter(n => !Number.isInteger(n) || n < 1 || n > total)
  if (findings.length === 0 || outside.length > 0) {
    return `Findings are numbered 1 to ${total}; got ${findings.join(', ') || 'none'}.`
  }
  const chosen = new Set(findings.map(n => n - 1))
  return { ...walk, decisions: walk.decisions.map((d, i) => (chosen.has(i) ? decision : d)) }
}

export function decisionOf(answer: string | undefined): Decision | null {
  const word = answer?.trim().toLowerCase() ?? ''
  if (word === '') {
    return null
  }
  return word.startsWith('fix') ? 'fix' : word.startsWith('issue') ? 'issue' : word.startsWith('skip') ? 'skip' : 'other'
}

export function decided(walk: Walk): number {
  return walk.decisions.filter(d => d !== null).length
}

export function bar(done: number, total: number): string {
  const filled = total === 0 ? 0 : Math.round((done / total) * BAR_WIDTH)
  return '▓'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
}

export function tally(walk: Walk): string {
  const count = (d: Decision) => walk.decisions.filter(x => x === d).length
  const parts = [`fix ${count('fix')}`, `issue ${count('issue')}`, `skip ${count('skip')}`]
  return count('other') > 0 ? [...parts, `other ${count('other')}`].join(' · ') : parts.join(' · ')
}

export function describe(finding: Finding): string {
  return [finding.where, finding.category, finding.label].filter(Boolean).join(' · ')
}
