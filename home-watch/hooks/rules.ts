type Decision = 'allow' | 'ask' | 'deny'
type Token = { word: string } | { op: string }
type Split = { tokens: Token[], nested: string[] }

export type Tag = 'blocked' | 'asked' | 'allowed'
export type Place = { home: string, root: string, cwd: string, ignoredRoot: string | null }
export type Seen = { tool: string, paths: string[], label: string }
export type Verdict = {
  decision: Decision
  setting?: string
  rule?: string
  hook?: string
  plugin?: string
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
const OPERATOR = /^(?:&&|\|\||;;|<<<|<<-|<<|&>>|&>|\d?>>|\d?>&|\d?>|<&|<|[;&|()])/
const WORD_BREAK = /[;|&<>()]/
const TILDE_END = /^(?:\/|$|[\s;&|:)<>])/
const HOME_VAR = /^\$(?:HOME\b|\{HOME\})/
const ASSIGNMENT = /^[A-Za-z_]\w*=/
const CD_FLAG = /^(?:-[LPe@]+|--)$/
const SCRIPT_FLAG = /^-[a-z]*c$/
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
export function placeOf(at: { home: string, root: string, cwd: string }): Place {
  const home = normalize(at.home, '/')
  const resolve = (root: string) => normalize(expandHome(root.trim(), home), home)
  const root = resolve(at.root)
  const isValid = !isUnder(home, root)
  return { home, root: isValid ? root : resolve(DEFAULT_ROOT), cwd: normalize(at.cwd, '/'), ignoredRoot: isValid ? null : at.root }
}

function closingParen(command: string, from: number): number {
  let depth = 1
  for (let i = from; i < command.length; i++) {
    const c = command[i]
    if (c === '\\') {
      i++
    } else if (c === "'") {
      const close = command.indexOf("'", i + 1)
      i = close < 0 ? command.length : close
    } else if (c === '(') {
      depth++
    } else if (c === ')' && --depth === 0) {
      return i
    }
  }
  return command.length
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

// Inside "…" a backslash escapes only $, `, ", \ and a newline, and `~` stays literal.
function doubleQuoted(command: string, from: number, home: string, nested: string[]): { text: string, end: number } {
  let text = ''
  let i = from
  while (i < command.length && command[i] !== '"') {
    const rest = command.slice(i)
    const next = command[i + 1] ?? ''
    if (command[i] === '\\' && /^[$`"\\\n]$/.test(next)) {
      text += next === '\n' ? '' : next
      i += 2
    } else if (rest.startsWith('$(')) {
      const close = closingParen(command, i + 2)
      nested.push(command.slice(i + 2, close))
      text += SUBSTITUTION
      i = close + 1
    } else if (command[i] === '`') {
      const close = closingBacktick(command, i + 1)
      nested.push(command.slice(i + 1, close))
      text += SUBSTITUTION
      i = close + 1
    } else if (HOME_VAR.test(rest)) {
      text += home
      i += HOME_VAR.exec(rest)?.[0].length ?? 1
    } else {
      text += command[i]
      i++
    }
  }
  return { text, end: i }
}

function skipHeredocs(command: string, from: number, heredocs: { delimiter: string, strip: boolean }[]): number {
  let i = from
  while (heredocs.length > 0 && i < command.length) {
    const doc = heredocs[0]
    const newline = command.indexOf('\n', i)
    const lineEnd = newline < 0 ? command.length : newline
    const line = command.slice(i, lineEnd)
    i = lineEnd + 1
    if (doc !== undefined && (doc.strip ? line.replace(/^\t+/, '') : line) === doc.delimiter) {
      heredocs.shift()
    }
  }
  return Math.min(i, command.length)
}

// Splits as the shell would: `~` expands only unquoted at a word's start or after an assignment's `=`/`:`,
// comments and heredoc bodies are dropped, and each `$(…)` or `…` comes back as a command of its own.
export function shellWords(command: string, home: string): Split {
  const tokens: Token[] = []
  const nested: string[] = []
  const heredocs: { delimiter: string, strip: boolean }[] = []
  let heredocStrip: boolean | null = null
  let word = ''
  let inWord = false
  const end = () => {
    if (inWord && heredocStrip !== null) {
      heredocs.push({ delimiter: word, strip: heredocStrip })
      heredocStrip = null
    } else if (inWord) {
      tokens.push({ word })
    }
    word = ''
    inWord = false
  }
  let i = 0
  while (i < command.length) {
    const c = command[i] ?? ''
    const rest = command.slice(i)
    if (c === '\\') {
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
      i = stop + 1
    } else if (c === '"') {
      const quoted = doubleQuoted(command, i + 1, home, nested)
      word += quoted.text
      inWord = true
      i = quoted.end + 1
    } else if (c === '`') {
      const close = closingBacktick(command, i + 1)
      nested.push(command.slice(i + 1, close))
      word += SUBSTITUTION
      inWord = true
      i = close + 1
    } else if (rest.startsWith('$(')) {
      const close = closingParen(command, i + 2)
      nested.push(command.slice(i + 2, close))
      word += SUBSTITUTION
      inWord = true
      i = close + 1
    } else if (c === '\n') {
      end()
      tokens.push({ op: ';' })
      i = skipHeredocs(command, i + 1, heredocs)
    } else if (/\s/.test(c)) {
      end()
      i++
    } else if (!inWord && c === '#') {
      const newline = command.indexOf('\n', i)
      i = newline < 0 ? command.length : newline
    } else if (!inWord && OPERATOR.test(rest)) {
      const op = OPERATOR.exec(rest)?.[0] ?? c
      tokens.push({ op })
      heredocStrip = op === '<<' || op === '<<-' ? op === '<<-' : heredocStrip
      i += op.length
    } else if (inWord && WORD_BREAK.test(c)) {
      end()
    } else if (c === '~' && TILDE_END.test(command.slice(i + 1)) && (!inWord || (ASSIGNMENT.test(word) && /[=:]$/.test(word)))) {
      word += home
      inWord = true
      i++
    } else if (HOME_VAR.test(rest)) {
      word += home
      inWord = true
      i += HOME_VAR.exec(rest)?.[0].length ?? 1
    } else {
      word += c
      inWord = true
      i++
    }
  }
  end()
  return { tokens, nested }
}

function wordOf(token: Token | undefined): string | undefined {
  return token !== undefined && 'word' in token ? token.word : undefined
}

function pathParts(word: string): string[] {
  const parts = ASSIGNMENT.test(word)
    ? word.slice(word.indexOf('=') + 1).split(':')
    : word.startsWith('-') && word.includes('=') ? [word.slice(word.indexOf('=') + 1)] : [word]
  return parts.map(part => part.split(SUBSTITUTION)[0] ?? '')
}

function isPathWord(word: string): boolean {
  return word.startsWith('/') || word === '..' || word.startsWith('../')
}

function leadingCd(tokens: readonly Token[], at: number): { target: string | undefined, next: number } | null {
  if (wordOf(tokens[at]) !== 'cd') {
    return null
  }
  let k = at + 1
  while (CD_FLAG.test(wordOf(tokens[k]) ?? '')) {
    k++
  }
  const target = wordOf(tokens[k])
  if (target !== undefined) {
    k++
  }
  const op = tokens[k]
  return op !== undefined && 'op' in op && CHAIN.has(op.op) ? { target, next: k + 1 } : null
}

function bashPaths(command: string, place: Place, start: string, depth: number): string[] {
  const { tokens, nested } = shellWords(command, place.home)
  const found: string[] = []
  let dir = start
  let previous = start
  let i = 0
  for (let cd = leadingCd(tokens, i); cd !== null; cd = leadingCd(tokens, i)) {
    const target = cd.target === '-' ? previous : normalize(cd.target ?? place.home, dir)
    if (cd.target !== '-') {
      found.push(target)
    }
    previous = dir
    dir = target
    i = cd.next
  }
  const rest = tokens.slice(i)
  const scripts = new Set<number>()
  rest.forEach((token, k) => {
    const name = wordOf(token)?.split('/').pop() ?? ''
    if (SHELLS.has(name) && SCRIPT_FLAG.test(wordOf(rest[k + 1]) ?? '') && wordOf(rest[k + 2]) !== undefined) {
      scripts.add(k + 2)
      nested.push(wordOf(rest[k + 2]) ?? '')
    }
  })
  rest.forEach((token, k) => {
    const word = wordOf(token)
    if (word !== undefined && !scripts.has(k)) {
      found.push(...pathParts(word).filter(isPathWord).map(path => normalize(path, dir)))
    }
  })
  if (depth < MAX_DEPTH) {
    for (const inner of nested) {
      found.push(...bashPaths(inner, place, dir, depth + 1))
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
  const pattern = tool === 'Glob' && typeof input.pattern === 'string' ? [resolve(globBase(expandHome(input.pattern, place.home)), base)] : []
  return [...named.map(path => resolve(path, place.cwd)), ...pattern]
}

function homePaths(tool: string, input: unknown, place: Place): string[] {
  if (typeof input !== 'object' || input === null) {
    return []
  }
  const fields = input as Record<string, unknown>
  const found = tool === 'Bash'
    ? typeof fields.command === 'string' ? bashPaths(fields.command, place, place.cwd, 0) : []
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

export function see(tool: string, input: unknown, place: Place): Seen {
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

// "asked" needs a dialog the person saw; an ask settled out of their sight is tagged by what became of the call.
export function tagFor(verdict: Verdict, seen: Seen, place: Place): Tag | null {
  if (seen.paths.length === 0 && !(seen.tool === 'Bash' && verdict.setting === READ_BLOCK)) {
    return null
  }
  if (verdict.decision === 'allow') {
    return 'allowed'
  }
  const isHome = isHomeCaused(verdict, place.home)
  if (isHome && verdict.dialog === true) {
    return 'asked'
  }
  if (verdict.didRun === true) {
    return 'allowed'
  }
  return isHome && (verdict.decision === 'deny' || verdict.refused === true) ? 'blocked' : null
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : v)
}

export function isSameCall(a: { tool: string, input: unknown }, b: { tool: string, input: unknown }): boolean {
  return a.tool === b.tool && canonical(a.input) === canonical(b.input)
}
