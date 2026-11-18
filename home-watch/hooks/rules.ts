export type Decision = 'allow' | 'ask' | 'deny'
export type Tag = 'blocked' | 'asks' | 'allowed'

export const READ_BLOCK = 'permissions.blockReadsOutsideWorkingDirectories'

const PATH_KEYS = ['file_path', 'path', 'notebook_path'] as const
// A path in shell text starts a word: after a blank, a quote, `=`, `:`, `(`, a redirect or a pipe.
const SHELL_PATH = /(?<=^|[\s'"=:(<>|;&`])(?:~|\$HOME\b|\$\{HOME\}|\/|\.\.\/)[^\s'"`;|&<>()]*/g

export function expandHome(path: string, home: string): string {
  if (path === '~' || path === '$HOME' || path === '${HOME}') {
    return home
  }
  const prefix = /^(?:~|\$HOME|\$\{HOME\})\//.exec(path)
  return prefix ? `${home}/${path.slice(prefix[0].length)}` : path
}

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

export function isUnder(path: string, dir: string): boolean {
  return path === dir || path.startsWith(dir.endsWith('/') ? dir : `${dir}/`)
}

function candidates(tool: string, input: unknown): string[] {
  if (typeof input !== 'object' || input === null) {
    return []
  }
  const fields = input as Record<string, unknown>
  if (tool === 'Bash') {
    return typeof fields.command === 'string' ? fields.command.match(SHELL_PATH) ?? [] : []
  }
  const named = PATH_KEYS.map(key => fields[key]).filter((v): v is string => typeof v === 'string')
  const pattern = tool === 'Glob' && typeof fields.pattern === 'string' && /^[~/$]/.test(fields.pattern) ? [fields.pattern] : []
  return [...named, ...pattern]
}

// The paths a call names under `home` but outside `root`, each once, `~` and `..` resolved.
export function homePaths(tool: string, input: unknown, at: { home: string, root: string, cwd: string }): string[] {
  const root = normalize(expandHome(at.root, at.home), at.cwd)
  const found = candidates(tool, input)
    .map(raw => normalize(expandHome(raw, at.home), at.cwd))
    .filter(path => isUnder(path, at.home) && !isUnder(path, root))
  return [...new Set(found)]
}

// The engine's verdict decides blocked and asked; a home path the engine let through is "allowed".
export function tagFor(verdict: { decision: Decision, setting?: string }, paths: readonly string[]): Tag | null {
  if (paths.length === 0 && verdict.setting !== READ_BLOCK) {
    return null
  }
  if (verdict.decision === 'deny') {
    return 'blocked'
  }
  return verdict.decision === 'ask' ? 'asks' : 'allowed'
}
