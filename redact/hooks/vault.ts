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
    .flatMap(item => [item, ...linesOf(item)])
    .filter(item => (item.Secret ?? '').length >= MIN_SECRET_LENGTH)
    .map(item => ({ rule: item.RuleID ?? 'secret', secret: item.Secret ?? '' }))
}

// A multi-line value (a PEM key) is also hidden line by line, since a partial read never holds it whole.
function linesOf(item: ReportItem): ReportItem[] {
  const lines = (item.Secret ?? '').split(/\r?\n/).map(line => line.trim())
  return lines.length < 2 ? [] : lines.filter(line => !/^-----.*-----$/.test(line)).map(line => ({ RuleID: item.RuleID, Secret: line }))
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

const CD = /^cd(?:\s+(\S+))?$/

function expandHome(word: string): string {
  return word.replace(/^\$(?:HOME|\{HOME\})(?=\/|$)/, '~')
}

function absolute(path: string, dir: string, home: string): string {
  return path.startsWith('/') ? path : path === '~' || path.startsWith('~/') ? `${home}${path.slice(1)}` : `${dir}/${path}`
}

function chdir(dir: string, home: string, target = '~'): string {
  const parts: string[] = []
  for (const part of absolute(expandHome(target.replace(/^(['"])(.*)\1$/, '$2')), dir, home).split('/')) {
    if (part === '..') {
      parts.pop()
    } else if (part !== '' && part !== '.') {
      parts.push(part)
    }
  }
  return `/${parts.join('/')}`
}

// Words of a shell command that could name a file: `cut -c1-9 a.env`, `jq . <cfg.json`, `--file=x`,
// each resolved against the directory its segment runs in after any `cd` before it.
export function pathWords(command: string, cwd: string, home: string): string[] {
  let dir = cwd
  let previous = cwd
  const paths: string[] = []
  for (const segment of command.split(/&&|\|\||[;|\n]/).map(part => part.trim())) {
    const cd = CD.exec(segment)
    if (cd !== null) {
      const next = cd[1] === '-' ? previous : chdir(dir, home, cd[1])
      previous = dir
      dir = next
      continue
    }
    const words = segment
      .split(/[\s|;&<>()`]+/)
      .map(word => expandHome(word.replace(/^['"]|['"]$/g, '').replace(/^-[^=]*=/, '')))
      .filter(word => word.length > 0 && !word.startsWith('-') && !word.includes('$'))
    paths.push(...words.map(word => absolute(word, dir, home)))
  }
  return [...new Set(paths)]
}

export function dropped(before: string, after: string, secrets: readonly string[]): string[] {
  return secrets.filter(secret => before.includes(secret) && !after.includes(secret))
}
