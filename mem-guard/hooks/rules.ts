export type Pressure = { usedBytes: number; maxBytes: number; psiAvg10: number }
export type Shell = { cwd: string; home: string }
export type ScriptsByDir = Record<string, Record<string, string>>
export type Invocation = { line: string; tool: string; call: string; script: string | null; dir: string }

const GIB = 1024 ** 3
const FULL_SHARE = 0.75
const PSI_LIMIT = 20

const HEAVY_TOOLS = ['nx', 'jest', 'vitest', 'playwright', 'tsc', 'ngc']
const NODE_TOOL = new RegExp(String.raw`(^|[^\w./-])(${['node', 'npx', 'pnpm', 'npm', 'yarn', ...HEAVY_TOOLS].join('|')})([^\w-]|$)`)
const PREFIX = /^(?:(?:sudo|time|nice|env|exec|then|do|else|if|while|until|\{|!)\s+|timeout\s+\S+\s+|\w+=\S*\s+)*/
const PNPM_FLAGS = String.raw`(?:(?:--filter|-F|-C|--dir)\s+\S+\s+|-[\w-]+(?:=\S+)?\s+)*`
const RUNNER = new RegExp(String.raw`^(?:npx\s+(?:-\S+\s+)*|pnpm\s+${PNPM_FLAGS}(?:exec\s+|dlx\s+|run\s+)?|yarn\s+(?:run\s+)?|node\s+(?=\S*node_modules\/\.bin\/)|)(?:\S*node_modules\/\.bin\/)?`)
const SCRIPT = new RegExp(String.raw`^(?:pnpm\s+${PNPM_FLAGS}(?:run\s+)?|npm\s+run\s+|yarn\s+(?:run\s+)?)([\w:-]+)`)
const SHELL_C = /^(?:ba)?sh\s+(?:-\w+\s+)*-c\s+(?:'([^']*)'|"((?:[^"\\]|\\.)*)")/
const CD = /^cd(?:\s+(\S+))?$/
const NX_LIGHT = /^nx\s+(show|graph|reset|daemon|report|list|--version)\b/
const NX_TEST = /^nx\s+(?:test\b|run\s+\S+:test(?::\S+)?(?=\s|$))|\s(?:-t|--targets?)[= ]\s*(?:\S*,)?test(?=[,\s]|$)/
const PARALLEL_ONE = /--parallel[= ]1([^0-9]|$)/
const WORKER_CAP = /\s(?:--maxWorkers|--max-workers|-w|--runInBand|-i)(?=[\s=]|$)/
const JEST_NO_RUN = /\s(?:--listTests|--showConfig|--clearCache|--version|-v|--help|-h)(?=\s|$)/
const KILL_BY_NAME = /\s(?:-[a-zA-Z]*f[a-zA-Z]*|--full)(?=\s|$)/

// Splits on control operators and command substitutions outside quotes; a heredoc body is no command.
export function segments(command: string): string[] {
  const parts: string[] = []
  const heredocs: string[] = []
  let part = ''
  let quote: '' | "'" | '"' = ''
  const cut = () => {
    parts.push(part.trim())
    part = ''
  }
  for (let i = 0; i < command.length; i++) {
    const c = command[i] ?? ''
    const two = command.slice(i, i + 2)
    if (quote === "'") {
      quote = c === "'" ? '' : quote
      part += c
    } else if (c === '\\') {
      part += two
      i++
    } else if (two === '$(' || c === '`' || (quote === '"' && c === ')')) {
      cut()
      i += two === '$(' ? 1 : 0
    } else if (quote === '"') {
      quote = c === '"' ? '' : quote
      part += c
    } else if (c === "'" || c === '"') {
      quote = c
      part += c
    } else if (two === '<<') {
      const tag = /^<<-?\s*(['"]?)(\w+)\1/.exec(command.slice(i))?.[2]
      if (tag !== undefined) {
        heredocs.push(tag)
      }
      part += two
      i++
    } else if (c === '\n' && heredocs.length > 0) {
      cut()
      for (const tag of heredocs.splice(0)) {
        const end = new RegExp(String.raw`\n\t*${tag}(?=\n|$)`).exec(command.slice(i))
        i = end === null ? command.length : i + end.index + end[0].length - 1
      }
    } else if (two === '&&' || two === '||') {
      cut()
      i++
    } else if (';|&\n()'.includes(c)) {
      cut()
    } else {
      part += c
    }
  }
  cut()
  return parts.filter(p => p.length > 0)
}

function resolvePath(dir: string, home: string, target = '~'): string {
  const raw = target.replace(/^(['"])(.*)\1$/, '$2')
  if (raw === '-') {
    return dir
  }
  const path = raw.startsWith('~') ? home + raw.slice(1) : raw.startsWith('/') ? raw : `${dir}/${raw}`
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (part === '..') {
      parts.pop()
    } else if (part !== '' && part !== '.') {
      parts.push(part)
    }
  }
  return `/${parts.join('/')}`
}

// `FOO=1 timeout 60 pnpm exec jest x` → line `pnpm exec jest x`, tool `jest`, call `jest x`; a `bash -c '…'` is opened up.
export function invocations(command: string, shell: Shell): Invocation[] {
  let dir = shell.cwd
  return segments(command).flatMap(part => {
    const line = part.replace(PREFIX, '').replace(/[\s}]+$/, '')
    const cd = CD.exec(line)
    if (cd !== null) {
      dir = resolvePath(dir, shell.home, cd[1])
    }
    const inner = SHELL_C.exec(line)
    const nested = inner === null ? [] : invocations(inner[1] ?? (inner[2] ?? '').replace(/\\(.)/g, '$1'), { ...shell, cwd: dir })
    const call = line.replace(RUNNER, '')
    return [{ line, tool: call.split(/\s/)[0] ?? '', call, script: SCRIPT.exec(line)?.[1] ?? null, dir }, ...nested]
  })
}

function liteSibling(script: string, scripts: Record<string, string>): string | null {
  if (script.endsWith(':lite')) {
    return null
  }
  for (let base = script; ; base = base.slice(0, base.lastIndexOf(':'))) {
    if (scripts[`${base}:lite`] !== undefined) {
      return base
    }
    if (!base.includes(':')) {
      return null
    }
  }
}

function lastArgument(line: string): string {
  return /(?:'[^']*'|"[^"]*"|\S+)$/.exec(line)?.[0] ?? ''
}

function invocationRefusal({ line, tool, call, script }: Invocation, scripts: Record<string, string>): string | null {
  if (tool === 'nx' && /^nx\s+(affected|run-many)\b/.test(call) && !PARALLEL_ONE.test(call)) {
    return "nx affected/run-many must run with --parallel=1. Prefer the repo's :lite script (pnpm run lint:affected:lite, typecheck:lite, test:affected:lite)."
  }
  const base = script === null ? null : liteSibling(script, scripts)
  if (base !== null) {
    return `use 'pnpm run ${base}:lite' instead of '${script}'.`
  }
  if (script === 'ci:local') {
    return 'ci:local runs everything in sequence (~45 min here). Push and let the pipeline be the gate.'
  }
  if (/^p(kill|grep)\b/.test(line) && KILL_BY_NAME.test(line) && !lastArgument(line).includes('[')) {
    return "pkill -f / pgrep -f with a plain pattern matches its own wrapper and kills it (exit 143). Stop it by port (fuser -k 4700/tcp), by saved PID, or bracket the pattern: pkill -f '[n]x serve'."
  }
  const isJest = (tool === 'jest' && !JEST_NO_RUN.test(call)) || (tool === 'nx' && NX_TEST.test(call))
  if (isJest && !WORKER_CAP.test(call)) {
    return 'jest runs need --maxWorkers=2 (or --runInBand): its pool otherwise sizes itself off the CPU count, per task.'
  }
  return null
}

export function refusal(calls: readonly Invocation[], scripts: ScriptsByDir): string | null {
  for (const call of calls) {
    const refused = invocationRefusal(call, scripts[call.dir] ?? {})
    if (refused !== null) {
      return refused
    }
  }
  return null
}

export function isHeavy(calls: readonly Invocation[]): boolean {
  return calls.some(
    ({ line, tool, call, script }) =>
      (HEAVY_TOOLS.includes(tool) && !NX_LIGHT.test(call)) ||
      (script !== null && /^(test|build|lint|typecheck|e2e|serve)/.test(script) && !script.endsWith(':lite')) ||
      /^docker(-compose|\s+compose)\b.*\sup\b/.test(line),
  )
}

export function crowdedRefusal(pressure: Pressure): string | null {
  const used = pressure.usedBytes / GIB
  const max = pressure.maxBytes / GIB
  if (pressure.usedBytes <= pressure.maxBytes * FULL_SHARE && pressure.psiAvg10 <= PSI_LIMIT) {
    return null
  }
  return `claude-cmd.slice is at ${used.toFixed(1)}/${max.toFixed(0)}G, pressure ${pressure.psiAvg10.toFixed(0)}%. Wait for a running build or test to finish, or push and let CI run it.`
}

// Leading `cd`s stay outside the wrapper so the shell's working directory still moves.
export function scoped(command: string): string {
  const cds = /^(?:\s*cd(?:\s+(?:'[^']*'|"[^"]*"|[^\s;&|'"]+))?\s*&&)*/.exec(command)?.[0] ?? ''
  const rest = command.slice(cds.length).trimStart()
  if (/^systemd-run/.test(rest) || !NODE_TOOL.test(rest)) {
    return command
  }
  const quoted = `'${rest.replace(/'/g, `'\\''`)}'`
  const wrapped = `systemd-run --user --scope -q --slice=claude-cmd.slice --expand-environment=no -p MemoryMax=8G -p MemorySwapMax=1G -- bash -c ${quoted}`
  return cds === '' ? wrapped : `${cds.trim()} ${wrapped}`
}

export function parsePressure(current: string, max: string, pressure: string): Pressure | null {
  const usedBytes = Number(current.trim())
  const maxBytes = Number(max.trim())
  const psiAvg10 = Number(/^some avg10=([\d.]+)/m.exec(pressure)?.[1] ?? NaN)
  return [usedBytes, maxBytes, psiAvg10].every(Number.isFinite) ? { usedBytes, maxBytes, psiAvg10 } : null
}
