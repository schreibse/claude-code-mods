import type { Vault } from '../types'

export type Finding = { rule: string; secret: string }

const TOKEN = /‹secret:([0-9a-f]{8})›/g
const MIN_SECRET_LENGTH = 8

export const PASS_THROUGH = new Set(['Agent', 'SendMessage', 'TodoWrite'])
export const RESTORING = new Set(['Write', 'Edit', 'NotebookEdit'])

function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function tokenFor(vault: Vault, secret: string): string {
  let id = fnv1a(secret)
  while (vault[id] !== undefined && vault[id]?.value !== secret) {
    id = fnv1a(id + secret)
  }
  return `‹secret:${id}›`
}

type ReportItem = { RuleID?: string; Secret?: string; ComponentSets?: { components?: ReportItem[] }[] | null }

// A composite finding (AWS key id + secret) carries its second value only as a component.
export function parseReport(stdout: string): Finding[] {
  const report = JSON.parse(stdout || '[]') as ReportItem[]
  return report
    .flatMap(item => [item, ...(item.ComponentSets ?? []).flatMap(set => set.components ?? [])])
    .filter(item => (item.Secret ?? '').length >= MIN_SECRET_LENGTH)
    .map(item => ({ rule: item.RuleID ?? 'secret', secret: item.Secret ?? '' }))
}

// Known values are replaced wherever they show up: the scanner may only recognise one next to its name.
export function seal(text: string, vault: Vault, findings: readonly Finding[]): { text: string; vault: Vault; added: Finding[] } {
  let next = vault
  const added: Finding[] = []
  for (const finding of findings) {
    if (!Object.values(next).some(entry => entry.value === finding.secret)) {
      const id = tokenFor(next, finding.secret).slice(8, -1)
      next = { ...next, [id]: { value: finding.secret, rule: finding.rule } }
      added.push(finding)
    }
  }
  const longestFirst = Object.entries(next).sort(([, a], [, b]) => b.value.length - a.value.length)
  let sealed = text
  for (const [id, entry] of longestFirst) {
    sealed = sealed.replaceAll(entry.value, `‹secret:${id}›`)
  }
  return { text: sealed, vault: next, added }
}

export function tokensIn(text: string): string[] {
  return [...new Set([...text.matchAll(TOKEN)].map(match => match[1] ?? ''))]
}

export function unseal(text: string, vault: Vault): string {
  return text.replace(TOKEN, (token, id: string) => vault[id]?.value ?? token)
}

export function unsealFields<T extends Record<string, unknown>>(input: T, vault: Vault): T {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === 'string' ? unseal(value, vault) : value])) as T
}

export type Verdict = { deny: string } | { restore: boolean }

export function judge(tool: string, inputText: string, vault: Vault): Verdict {
  const ids = tokensIn(inputText)
  if (ids.length === 0) {
    return { restore: false }
  }
  const unknown = ids.filter(id => vault[id] === undefined)
  if (unknown.length > 0) {
    return { deny: `redact: ${unknown.map(id => `‹secret:${id}›`).join(', ')} is no longer known (the session restarted or the mod reloaded), so it cannot be restored. Re-read the file, or leave that value untouched and edit around it.` }
  }
  if (RESTORING.has(tool)) {
    return { restore: true }
  }
  if (PASS_THROUGH.has(tool)) {
    return { restore: false }
  }
  return { deny: `redact: ${tool} input contains a ‹secret:…› token. Tokens stand for values you must not see; they are restored only in Write, Edit and NotebookEdit. Work on the file instead (e.g. Edit), or ask the user.` }
}

export function dropped(before: string, after: string, secrets: readonly string[]): string[] {
  return secrets.filter(secret => before.includes(secret) && !after.includes(secret))
}
