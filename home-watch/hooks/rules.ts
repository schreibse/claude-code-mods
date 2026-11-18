type Decision = 'allow' | 'ask' | 'deny'
export type Tag = 'blocked' | 'asked' | 'allowed'
type Token = { word: string } | { op: string }

export const READ_BLOCK = 'permissions.blockReadsOutsideWorkingDirectories'

const FILE_TOOLS: Record<string, readonly string[]> = {
  Read: ['file_path'],
  Write: ['file_path'],
  Edit: ['file_path'],
  NotebookEdit: ['notebook_path'],
  Grep: ['path'],
  Glob: ['path'],
}
const OPERATOR = /^(?:&&|\|\||&>>?|\d?>>?|<<?|[;&|()])/
const HOME_VAR = /^\$(?:HOME\b|\{HOME\})/
const ASSIGNMENT = /^[A-Za-z_]\w*=/
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

export function rootDir(root: string, home: string): string {
  const expanded = expandHome(root, home)
  return normalize(expanded, home)
}

function closingQuote(command: string, from: number): number {
  for (let i = from; i < command.length; i++) {
    if (command[i] === '\\') {
      i++
    } else if (command[i] === '"') {
      return i
    }
  }
  return command.length
}

function expandVars(text: string, home: string): string {
  return text.replace(/\\(.)/g, '$1').replace(/\$(?:HOME\b|\{HOME\})/g, home)
}

// Expands `~` and `$HOME` where the shell would: `~` only at a word's start or after an assignment's `=` or `:`, nothing inside '…'.
export function shellWords(command: string, home: string): Token[] {
  const tokens: Token[] = []
  let word = ''
  let inWord = false
  const end = () => {
    if (inWord) {
      tokens.push({ word })
    }
    word = ''
    inWord = false
  }
  for (let i = 0; i < command.length; i++) {
    const c = command[i] ?? ''
    if (c === "'") {
      const close = command.indexOf("'", i + 1)
      const stop = close < 0 ? command.length : close
      word += command.slice(i + 1, stop)
      i = stop
      inWord = true
    } else if (c === '"') {
      const stop = closingQuote(command, i + 1)
      word += expandVars(command.slice(i + 1, stop), home)
      i = stop
      inWord = true
    } else if (c === '\\') {
      word += command[i + 1] ?? ''
      i++
      inWord = true
    } else if (/\s/.test(c)) {
      end()
      if (c === '\n') {
        tokens.push({ op: ';' })
      }
    } else if (!inWord && OPERATOR.test(command.slice(i))) {
      const op = OPERATOR.exec(command.slice(i))?.[0] ?? c
      tokens.push({ op })
      i += op.length - 1
    } else if (c === '~' && /^(?:\/|$|[\s;&|:)])/.test(command.slice(i + 1)) && (!inWord || (ASSIGNMENT.test(word) && /[=:]$/.test(word)))) {
      word += home
      inWord = true
    } else if (c === '$' && HOME_VAR.test(command.slice(i))) {
      word += home
      i += (HOME_VAR.exec(command.slice(i))?.[0].length ?? 1) - 1
      inWord = true
    } else if (inWord && /[;|&<>()]/.test(c)) {
      end()
      i--
    } else {
      word += c
      inWord = true
    }
  }
  end()
  return tokens
}

function pieces(word: string): string[] {
  if (ASSIGNMENT.test(word)) {
    return word.slice(word.indexOf('=') + 1).split(':')
  }
  return word.startsWith('-') && word.includes('=') ? [word.slice(word.indexOf('=') + 1)] : [word]
}

function isPathWord(word: string): boolean {
  return word.startsWith('/') || word === '..' || word.startsWith('../')
}

function bashPaths(command: string, home: string, cwd: string): string[] {
  const tokens = shellWords(command, home)
  const found: string[] = []
  let dir = cwd
  let previous = cwd
  let i = 0
  for (let cd = leadingCd(tokens, i); cd !== null; cd = leadingCd(tokens, i)) {
    const target = cd.target === '-' ? previous : normalize(cd.target ?? home, dir)
    if (cd.target !== '-') {
      found.push(target)
    }
    previous = dir
    dir = target
    i = cd.next
  }
  for (const token of tokens.slice(i)) {
    if ('word' in token) {
      found.push(...pieces(token.word).filter(isPathWord).map(path => normalize(path, dir)))
    }
  }
  return found
}

function leadingCd(tokens: readonly Token[], at: number): { target: string | undefined, next: number } | null {
  const first = tokens[at]
  if (first === undefined || !('word' in first) || first.word !== 'cd') {
    return null
  }
  const second = tokens[at + 1]
  if (second === undefined) {
    return null
  }
  if ('op' in second) {
    return second.op === '&&' ? { target: undefined, next: at + 2 } : null
  }
  const third = tokens[at + 2]
  return third !== undefined && 'op' in third && third.op === '&&' ? { target: second.word, next: at + 3 } : null
}

function fileToolPaths(tool: string, input: Record<string, unknown>, home: string, cwd: string): string[] {
  const named = (FILE_TOOLS[tool] ?? []).map(key => input[key]).filter((v): v is string => typeof v === 'string')
  const base = typeof input.path === 'string' ? normalize(expandHome(input.path, home), cwd) : cwd
  const pattern = tool === 'Glob' && typeof input.pattern === 'string' && /^(?:[~/$]|\.\.)/.test(input.pattern) ? [normalize(expandHome(input.pattern, home), base)] : []
  return [...named.map(path => normalize(expandHome(path, home), cwd)), ...pattern]
}

export function homePaths(tool: string, input: unknown, at: { home: string, root: string, cwd: string }): string[] {
  if (typeof input !== 'object' || input === null) {
    return []
  }
  const home = normalize(at.home, '/')
  const fields = input as Record<string, unknown>
  const found = tool === 'Bash'
    ? typeof fields.command === 'string' ? bashPaths(fields.command, home, at.cwd) : []
    : fileToolPaths(tool, fields, home, at.cwd)
  const root = rootDir(at.root, home)
  return [...new Set(found.filter(path => isUnder(path, home) && !isUnder(path, root)))]
}

export type Verdict = {
  decision: Decision
  setting?: string
  rule?: string
  hook?: string
  plugin?: string
  approver?: 'host' | 'person'
  judged?: Decision
  ran?: boolean
}

// A verdict with no rule, hook or plugin behind it is core's own check, which is where the working-directory limits live.
function isHomeCaused(verdict: Verdict, home: string): boolean {
  if (verdict.setting === READ_BLOCK) {
    return true
  }
  if (verdict.rule !== undefined) {
    return verdict.rule.includes('~/') || verdict.rule.includes('(~)') || verdict.rule.includes(`${home}/`)
  }
  return verdict.hook === undefined && verdict.plugin === undefined
}

// An ask nobody can answer is a deny; one auto mode's classifier settles never reaches the person.
export function tagFor(verdict: Verdict, paths: readonly string[], tool: string, home: string): Tag | null {
  if (paths.length === 0 && !(tool === 'Bash' && verdict.setting === READ_BLOCK)) {
    return null
  }
  if (verdict.decision === 'allow') {
    return 'allowed'
  }
  if (!isHomeCaused(verdict, home)) {
    return verdict.ran ? 'allowed' : null
  }
  if (verdict.decision === 'deny' || verdict.approver === undefined || verdict.judged === 'deny') {
    return 'blocked'
  }
  return verdict.judged === 'allow' ? 'allowed' : 'asked'
}

export function label(paths: readonly string[], tool: string, input: unknown, home: string): string {
  const path = paths[0]
  if (path !== undefined) {
    return path === home ? '~' : path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
  }
  const command = tool === 'Bash' && typeof input === 'object' && input !== null ? (input as { command?: unknown }).command : undefined
  if (typeof command !== 'string') {
    return tool
  }
  const line = command.trim().replace(/\s+/g, ' ')
  return line.length > LABEL_LENGTH ? `${line.slice(0, LABEL_LENGTH - 1)}…` : line
}
