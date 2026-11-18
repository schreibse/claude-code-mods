type Decision = 'allow' | 'ask' | 'deny'
type Token = { word: string } | { op: string }
type Heredoc = { delimiter: string; strip: boolean; expands: boolean }
type Scan = { tokens: Token[]; nested: string[]; end: number }
type Command = { words: string[]; after: string | undefined }

export type Tag = 'blocked' | 'asked' | 'allowed'
export type Place = { home: string; root: string; cwd: string; problem: string | null }
export type Sighting = { tool: string; paths: string[]; label: string }
export type PendingCall = { id: string; tool: string; input: unknown; agentId?: string }
export type Verdict = {
  decision: Decision
  setting?: string
  rule?: string
  hook?: string
  plugin?: string
  approver?: 'host' | 'person'
  dialog?: boolean
  refused?: boolean
  didRun?: boolean
}

export const DEFAULT_ROOT = '~/Dev'
export const READ_BLOCK = 'permissions.blockReadsOutsideWorkingDirectories'

const FILE_TOOLS: Record<string, readonly string[]> = {
  Read: ['file_path'],
  Write: ['file_path'],
  Edit: ['file_path'],
  NotebookEdit: ['notebook_path'],
  Grep: ['path'],
  Glob: ['path'],
}
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash'])
const CHAIN = new Set(['&&', ';'])
const SEPARATORS = new Set(['&&', '||', ';', ';;', '|', '&', '(', ')'])
const OPERATOR = /^(?:&&|\|\||;;|<<<|<<-|<<|&>>|&>|\d?>>|\d?>&|\d?>|<&|<|[;&|()])/
const WORD_BREAK = /[;|&<>()]/
const TILDE_END = /^(?:\/|$|[\s;&|:)<>])/
const HOME_VAR = /^\$(?:HOME\b|\{HOME\})/
const ASSIGNMENT = /^[A-Za-z_]\w*=/
const CD_FLAG = /^(?:-[LPe@]+|--)$/
const SCRIPT_FLAGS = /^-[A-Za-z]*c[A-Za-z]*$/
const OPTION_WITH_VALUE = /^(?:[-+]o|-O)$/
const PATH_WORD = /^(?:\/|\.{1,2}(?:\/|$))/
const GLOB_CHAR = /[*?[{]/
const BLOCK_SETTING = /OutsideWorkingDirectories$/
// Stands for a command substitution's unknown output, so `$(x)/y` is never taken for the path `/y`.
const SUBSTITUTION = '\u0000'
const MAX_DEPTH = 4
const LABEL_LENGTH = 48

export function normalize(path: string, cwd: string): string {
  const parts: string[] = []
  for (const part of (path.startsWith('/') ? path : `${cwd}/${path}`).split('/')) {
    if (part === '..') {
      parts.pop()
    } else if (part !== '' && part !== '.') {
      parts.push(part)
    }
  }
  return `/${parts.join('/')}`
}

export function expandHome(path: string, home: string): string {
  if (path === '~' || path.startsWith('~/')) {
    return `${home}${path.slice(1)}`
  }
  const variable = HOME_VAR.exec(path)
  return variable ? `${home}${path.slice(variable[0].length)}` : path
}

export function isUnder(path: string, dir: string): boolean {
  return path === dir || path.startsWith(dir === '/' ? '/' : `${dir}/`)
}

// A root that is home itself or above it would hide every path, so the default stands in for it.
export function placeOf(at: { home: string; root: string; cwd: string }): Place {
  const home = normalize(at.home, '/')
  const resolve = (root: string) => normalize(expandHome(root.trim(), home), home)
  const root = resolve(at.root)
  const isRootBelowHome = !isUnder(home, root)
  const problem = home === '/'
    ? 'HOME is not set: nothing is watched'
    : isRootBelowHome ? null : `root "${at.root}" ignored, using ${DEFAULT_ROOT}`
  return { home, root: isRootBelowHome ? root : resolve(DEFAULT_ROOT), cwd: normalize(at.cwd, '/'), problem }
}

function closingBacktick(command: string, from: number): number {
  for (let i = from; i < command.length; i++) {
    if (command[i] === '\\') {
      i++
    } else if (command[i] === '`') {
      return i
    }
  }
  return command.length
}

// `$((…))` is arithmetic, `$(…)` and `…` hand their command to `nested`, `$HOME` is home.
function expansionAt(command: string, at: number, home: string, nested: string[]): { text: string; next: number } | null {
  const ahead = command.slice(at)
  if (ahead.startsWith('$((')) {
    const close = command.indexOf('))', at + 3)
    return { text: SUBSTITUTION, next: close < 0 ? command.length : close + 2 }
  }
  if (ahead.startsWith('$(')) {
    const inner = scan(command, at + 2, home, true)
    nested.push(command.slice(at + 2, inner.end))
    return { text: SUBSTITUTION, next: inner.end + 1 }
  }
  if (ahead.startsWith('`')) {
    const close = closingBacktick(command, at + 1)
    nested.push(command.slice(at + 1, close))
    return { text: SUBSTITUTION, next: close + 1 }
  }
  const variable = HOME_VAR.exec(ahead)
  return variable ? { text: home, next: at + variable[0].length } : null
}

// Inside "…" a backslash escapes only $, `, ", \ and a newline, and `~` stays literal.
function doubleQuoted(command: string, from: number, home: string, nested: string[]): { text: string; end: number } {
  let text = ''
  let i = from
  while (i < command.length && command[i] !== '"') {
    const next = command[i + 1] ?? ''
    const expansion = command[i] === '\\' ? null : expansionAt(command, i, home, nested)
    if (command[i] === '\\' && /^[$`"\\\n]$/.test(next)) {
      text += next === '\n' ? '' : next
      i += 2
    } else if (expansion !== null) {
      text += expansion.text
      i = expansion.next
    } else {
      text += command[i]
      i++
    }
  }
  return { text, end: i }
}

function skipHeredocs(command: string, from: number, heredocs: Heredoc[], home: string, nested: string[]): number {
  let i = from
  while (heredocs.length > 0 && i < command.length) {
    const doc = heredocs[0]
    const newline = command.indexOf('\n', i)
    const lineEnd = newline < 0 ? command.length : newline
    const line = command.slice(i, lineEnd)
    i = lineEnd + 1
    if (doc === undefined || (doc.strip ? line.replace(/^\t+/, '') : line) === doc.delimiter) {
      heredocs.shift()
    } else if (doc.expands) {
      for (let k = 0; k < line.length;) {
        k = expansionAt(line, k, home, nested)?.next ?? k + 1
      }
    }
  }
  return Math.min(i, command.length)
}

// Splits as the shell would: `~` expands only unquoted at a word's start or after an assignment's `=`/`:`,
// comments, heredoc bodies and `((…))` are dropped, and inside parentheses a `)` at depth 0 ends the scan.
function scan(command: string, from: number, home: string, isInParens: boolean): Scan {
  const tokens: Token[] = []
  const nested: string[] = []
  const heredocs: Heredoc[] = []
  let pendingHeredoc: { strip: boolean } | null = null
  let word = ''
  let inWord = false
  let isQuoted = false
  let depth = 0
  const end = () => {
    if (inWord && pendingHeredoc !== null) {
      heredocs.push({ delimiter: word, strip: pendingHeredoc.strip, expands: !isQuoted })
      pendingHeredoc = null
    } else if (inWord) {
      tokens.push({ word })
    }
    word = ''
    inWord = false
    isQuoted = false
  }
  let i = from
  while (i < command.length) {
    const c = command[i] ?? ''
    const ahead = command.slice(i)
    const expansion = c === '$' || c === '`' ? expansionAt(command, i, home, nested) : null
    if (expansion !== null) {
      word += expansion.text
      inWord = true
      i = expansion.next
    } else if (c === '\\') {
      if (command[i + 1] !== '\n') {
        word += command[i + 1] ?? ''
        inWord = true
      }
      i += 2
    } else if (c === "'") {
      const close = command.indexOf("'", i + 1)
      const stop = close < 0 ? command.length : close
      word += command.slice(i + 1, stop)
      inWord = true
      isQuoted = true
      i = stop + 1
    } else if (c === '"') {
      const quoted = doubleQuoted(command, i + 1, home, nested)
      word += quoted.text
      inWord = true
      isQuoted = true
      i = quoted.end + 1
    } else if (c === '\n') {
      end()
      tokens.push({ op: ';' })
      i = skipHeredocs(command, i + 1, heredocs, home, nested)
    } else if (/\s/.test(c)) {
      end()
      i++
    } else if (!inWord && c === '#') {
      const newline = command.indexOf('\n', i)
      i = newline < 0 ? command.length : newline
    } else if (!inWord && ahead.startsWith('((')) {
      const close = command.indexOf('))', i + 2)
      i = close < 0 ? command.length : close + 2
    } else if (!inWord && OPERATOR.test(ahead)) {
      const op = OPERATOR.exec(ahead)?.[0] ?? c
      if (isInParens && op === ')' && depth === 0) {
        return { tokens, nested, end: i }
      }
      depth += op === '(' ? 1 : op === ')' ? -1 : 0
      tokens.push({ op })
      pendingHeredoc = op === '<<' || op === '<<-' ? { strip: op === '<<-' } : pendingHeredoc
      i += op.length
    } else if (inWord && WORD_BREAK.test(c)) {
      end()
    } else if (c === '~' && TILDE_END.test(command.slice(i + 1)) && (!inWord || (ASSIGNMENT.test(word) && /[=:]$/.test(word)))) {
      word += home
      inWord = true
      i++
    } else {
      word += c
      inWord = true
      i++
    }
  }
  end()
  return { tokens, nested, end: command.length }
}

export function shellWords(command: string, home: string): { tokens: Token[]; nested: string[] } {
  const { tokens, nested } = scan(command, 0, home, false)
  return { tokens, nested }
}

function commandsOf(tokens: readonly Token[]): Command[] {
  const commands: Command[] = []
  let words: string[] = []
  for (const token of tokens) {
    if ('word' in token) {
      words.push(token.word)
    } else if (SEPARATORS.has(token.op)) {
      commands.push({ words, after: token.op })
      words = []
    }
  }
  commands.push({ words, after: undefined })
  return commands
}

function beforeSubstitution(word: string): string {
  return word.split(SUBSTITUTION)[0] ?? ''
}

function pathParts(word: string): string[] {
  const parts = ASSIGNMENT.test(word)
    ? word.slice(word.indexOf('=') + 1).split(':')
    : word.startsWith('-') && word.includes('=') ? [word.slice(word.indexOf('=') + 1)] : [word]
  return parts.map(beforeSubstitution)
}

function scriptAt(words: readonly string[], at: number): number | undefined {
  if (!SHELLS.has(words[at]?.split('/').pop() ?? '')) {
    return undefined
  }
  for (let k = at + 1; k < words.length; k++) {
    const word = words[k] ?? ''
    if (SCRIPT_FLAGS.test(word)) {
      const script = words[k + 1] === '--' ? k + 2 : k + 1
      return script < words.length ? script : undefined
    }
    if (OPTION_WITH_VALUE.test(word)) {
      k++
    } else if (!word.startsWith('-') && !word.startsWith('+')) {
      return undefined
    }
  }
  return undefined
}

function bashPaths(command: string, home: string, start: string, depth: number): string[] {
  const { tokens, nested } = shellWords(command, home)
  const found: string[] = []
  let dir: string | null = start
  let previous: string | null = start
  let isChained = true
  for (const { words, after } of commandsOf(tokens)) {
    const name = words.findIndex(word => !ASSIGNMENT.test(word))
    const script = scriptAt(words, name)
    if (isChained && words[name] === 'cd' && after !== undefined && CHAIN.has(after)) {
      const raw = words.slice(name + 1).find(word => !CD_FLAG.test(word))
      if (raw === '-') {
        [dir, previous] = [previous, dir]
      } else {
        const known = beforeSubstitution(raw ?? home)
        const target: string | null = known === '' || (dir === null && !known.startsWith('/')) ? null : normalize(known, dir ?? '/')
        if (target !== null) {
          found.push(target)
        }
        previous = dir
        dir = raw?.includes(SUBSTITUTION) ? null : target
      }
    }
    words.forEach((word, k) => {
      if (k === script) {
        nested.push(word)
        return
      }
      for (const part of pathParts(word)) {
        if (PATH_WORD.test(part) && (part.startsWith('/') || dir !== null)) {
          found.push(normalize(part, dir ?? '/'))
        }
      }
    })
    if (after !== undefined && !CHAIN.has(after)) {
      isChained = false
    }
  }
  if (depth < MAX_DEPTH) {
    for (const inner of nested) {
      found.push(...bashPaths(inner, home, dir ?? start, depth + 1))
    }
  }
  return found
}

function globBase(pattern: string): string {
  const at = pattern.search(GLOB_CHAR)
  return at < 0 ? pattern : pattern.slice(0, pattern.lastIndexOf('/', at) + 1)
}

function fileToolPaths(tool: string, input: Record<string, unknown>, place: Place): string[] {
  const resolve = (path: string, dir: string) => normalize(expandHome(path, place.home), dir)
  const named = (FILE_TOOLS[tool] ?? []).map(key => input[key]).filter((v): v is string => typeof v === 'string')
  const base = typeof input.path === 'string' ? resolve(input.path, place.cwd) : place.cwd
  const prefix = tool === 'Glob' && typeof input.pattern === 'string' ? globBase(expandHome(input.pattern, place.home)) : ''
  return [...named.map(path => resolve(path, place.cwd)), ...(prefix === '' ? [] : [resolve(prefix, base)])]
}

function homePaths(tool: string, input: unknown, place: Place): string[] {
  if (typeof input !== 'object' || input === null || place.home === '/') {
    return []
  }
  const fields = input as Record<string, unknown>
  const found = tool === 'Bash'
    ? typeof fields.command === 'string' ? bashPaths(fields.command, place.home, place.cwd, 0) : []
    : fileToolPaths(tool, fields, place)
  return [...new Set(found.filter(path => isUnder(path, place.home) && !isUnder(path, place.root)))]
}

function label(paths: readonly string[], tool: string, input: unknown, home: string): string {
  const path = paths[0]
  if (path !== undefined) {
    return `~${path.slice(home.length)}`
  }
  const command = tool === 'Bash' && typeof input === 'object' && input !== null ? (input as { command?: unknown }).command : undefined
  if (typeof command !== 'string') {
    return tool
  }
  const characters = Array.from(command.trim().replace(/\s+/g, ' '))
  return characters.length > LABEL_LENGTH ? `${characters.slice(0, LABEL_LENGTH - 1).join('')}…` : characters.join('')
}

export function sightingOf(tool: string, input: unknown, place: Place): Sighting {
  const paths = homePaths(tool, input, place)
  return { tool, paths, label: label(paths, tool, input, place.home) }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function namesHome(rule: string, home: string): boolean {
  return new RegExp(`(?:^|[(\\s:=,/])(?:~|${escapeRegExp(home)})(?=$|[/)\\s:*,])`).test(rule)
}

// With home-watch the innermost mod, a verdict with no setting, rule, hook or plugin is core's own path check.
function isHomeCaused(verdict: Verdict, home: string): boolean {
  if (verdict.setting !== undefined) {
    return BLOCK_SETTING.test(verdict.setting)
  }
  if (verdict.rule !== undefined) {
    return namesHome(verdict.rule, home)
  }
  return verdict.hook === undefined && verdict.plugin === undefined
}

// "asked" needs a dialog the person saw; an ask settled out of their sight is tagged by what became of the call,
// and one with no approver is a deny.
export function tagFor(verdict: Verdict, sighting: Sighting, home: string): Tag | null {
  if (sighting.paths.length === 0 && !(sighting.tool === 'Bash' && verdict.setting === READ_BLOCK)) {
    return null
  }
  if (verdict.decision === 'allow') {
    return verdict.refused === true ? null : 'allowed'
  }
  const isHome = isHomeCaused(verdict, home)
  if (isHome && verdict.dialog === true) {
    return 'asked'
  }
  if (verdict.didRun === true) {
    return 'allowed'
  }
  const isRefused = verdict.decision === 'deny' || verdict.approver === undefined || verdict.refused === true
  return isHome && isRefused ? 'blocked' : null
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : v)
}

// A permission request carries no call id: the oldest pending call of the same loop, tool and input is the one asked about.
export function requestedCall(pending: readonly PendingCall[], request: { tool: string; input: unknown; agentId?: string }): string | undefined {
  const input = canonical(request.input)
  return pending.find(call => call.tool === request.tool && call.agentId === request.agentId && canonical(call.input) === input)?.id
}
