export type Pressure = { usedBytes: number; maxBytes: number; psiAvg10: number }
export type Shell = { cwd: string; home: string }
export type ScriptsByDir = Record<string, Record<string, string>>
export type Invocation = { line: string; tool: string; call: string; script: string | null; dir: string }

const GIB = 1024 ** 3
const FULL_SHARE = 0.75
const PSI_LIMIT = 20

const HEAVY_TOOLS = ['nx', 'jest', 'vitest', 'playwright', 'tsc', 'ngc']
const NODE_TOOLS = ['node', 'npx', 'pnpm', 'npm', 'yarn', ...HEAVY_TOOLS]
const PREFIX = /^(?:(?:sudo|time|nice|env|exec|command|then|do|else|if|while|until|\{|!)\s+|timeout\s+\S+\s+|\w+=\S*\s+)*/
const PNPM_FLAGS = String.raw`(?:(?:--filter|-F|-C|--dir)\s+\S+\s+|-[\w-]+(?:=\S+)?\s+)*`
const RUNNER = new RegExp(String.raw`^(?:npx\s+(?:-\S+\s+)*|npm\s+(?:exec|x)\s+(?:-\S+\s+)*|pnpm\s+${PNPM_FLAGS}(?:exec\s+|dlx\s+|run\s+)?|yarn\s+(?:run\s+)?|node\s+(?=\S*node_modules\/\.bin\/)|)(?:\S*node_modules\/\.bin\/)?`)
const SCRIPT = new RegExp(String.raw`^(?:pnpm\s+${PNPM_FLAGS}(?:run\s+)?|npm\s+run\s+|yarn\s+(?:run\s+)?)([\w:-]+)`)
const SHELL_C = /^(?:ba)?sh\s+(?:-\w+\s+)*-c\s+(?:'([^']*)'|"((?:[^"\\]|\\.)*)")/
const CD = /^cd(?:\s+(\S+))?$/
const NX_LIGHT = /^nx\s+(show|graph|reset|daemon|report|list|--version)\b/
const NX_TEST = /^nx\s+(?:test\b|run\s+\S+:test(?::\S+)?(?=\s|$))|\s(?:-t|--targets?)[= ]\s*(?:\S*,)?test(?=[,\s]|$)/
const PARALLEL_ONE = /--parallel[= ]1([^0-9]|$)/
const WORKER_CAP = /\s(?:--runInBand|-i)(?=\s|$)|\s(?:--maxWorkers|--max-workers|-w)(?:=|\s+)(?![^\s%]*%)\S/
const JEST_NO_RUN = /\s(?:--listTests|--showConfig|--clearCache|--version|-v|--help|-h)(?=\s|$)/
const KILL_BY_NAME = /\s(?:-[a-zA-Z]*f[a-zA-Z]*|--full)(?=\s|$)/
const KILL_VALUE_FLAG = /^(?:-[GgPstuU]|--(?:signal|euid|uid|group|pgroup|parent|session|terminal|ns|nslist))$/
const WORD = /(?:'[^']*'|"[^"]*"|[^\s'"])+/g

// Splits on control operators and command substitutions outside quotes; a heredoc body is no command.
export function segments(command: string): string[] {
  const parts: string[] = []
  const heredocs: string[] = []
  let part = ''
  let quote: '' | "'" | '"' = ''
  const opened: Array<'' | '"'> = []
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
    } else if (two === '$(') {
      cut()
      opened.push(quote)
      quote = ''
      i++
    } else if (c === '`') {
      cut()
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
    } else if (c === '(') {
      cut()
      opened.push('')
    } else if (c === ')') {
      cut()
      quote = opened.pop() ?? ''
    } else if (';|&\n'.includes(c)) {
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
  return scripts[`${script}:lite`] === undefined ? null : script
}

function words(line: string): string[] {
  return line.match(WORD) ?? []
}

// The first operand that is neither a flag nor a flag's value.
function killPattern(line: string): string {
  const args = words(line).slice(1)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? ''
    if (KILL_VALUE_FLAG.test(arg)) {
      i++
    } else if (!arg.startsWith('-')) {
      return arg
    }
  }
  return ''
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
  if (/^(?:\S*\/)?p(kill|grep)\s/.test(line) && KILL_BY_NAME.test(line) && !killPattern(line).includes('[')) {
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

function runsNode({ line, tool }: Invocation): boolean {
  const program = (line.split(/\s/)[0] ?? '').replace(/^.*\//, '')
  return NODE_TOOLS.includes(program) || NODE_TOOLS.includes(tool)
}

// Leading `cd`s stay outside the wrapper so the shell's working directory still moves.
export function scoped(command: string): string {
  const cds = /^(?:\s*cd(?:\s+(?:'[^']*'|"[^"]*"|[^\s;&|'"]+))?\s*(?:&&|;))*/.exec(command)?.[0] ?? ''
  const rest = command.slice(cds.length).trimStart()
  if (/^systemd-run/.test(rest) || !invocations(rest, { cwd: '/', home: '' }).some(runsNode)) {
    return command
  }
  const quoted = `'${rest.replace(/'/g, `'\\''`)}'`
  const wrapped = `systemd-run --user --scope -q --slice=claude-cmd.slice --expand-environment=no -p MemoryMax=30% -p MemorySwapMax=4% -- bash -c ${quoted}`
  return cds === '' ? wrapped : `${cds.trim()} ${wrapped}`
}

export function parsePressure(current: string, max: string, pressure: string): Pressure | null {
  const usedBytes = Number(current.trim())
  const maxBytes = Number(max.trim())
  const psiAvg10 = Number(/^some avg10=([\d.]+)/m.exec(pressure)?.[1] ?? NaN)
  return [usedBytes, maxBytes, psiAvg10].every(Number.isFinite) ? { usedBytes, maxBytes, psiAvg10 } : null
}

const MAX_HEAVY_AT_ONCE = 2
// A test runner, a build or an nx task; the nx daemon and a dev server stay out, they live for hours.
const HEAVY_PROCESS =
  /\/jest(?:-cli)?\/bin\/|jest-worker\/build\/workers|\/vitest\/|playwright\/(?:cli\.js|lib\/common\/process)|\/typescript\/(?:bin|lib)\/tsc\b|\/compiler-cli\/bundles\/src\/bin\/ngc|nx\/dist\/bin\/run-executor\.js/
const SERVE = /\bnx(?:\.js)?\s+serve\b|:serve(?::\S+)?(?:\s|$)/

/** Each scope in claude-cmd.slice with its processes' args, from `ps -eo cgroup=,args=`. */
function scopesOf(ps: string): string[][] {
  const scopes = new Map<string, string[]>()
  for (const row of ps.split('\n')) {
    const match = /\/claude-cmd\.slice\/(run-[^\s/]+\.scope)\S*\s+(.*)$/.exec(row)
    if (match) {
      scopes.set(match[1], [...(scopes.get(match[1]) ?? []), match[2]])
    }
  }
  return [...scopes.values()]
}

/** Heavy commands running in claude-cmd.slice, one per scope. */
export function heavyScopes(ps: string): number {
  return scopesOf(ps).filter(args => !args.some(arg => SERVE.test(arg)) && args.some(arg => HEAVY_PROCESS.test(arg))).length
}

/** Dev servers running in claude-cmd.slice, one per scope. */
export function serveScopes(ps: string): number {
  return scopesOf(ps).filter(args => args.some(arg => SERVE.test(arg))).length
}

export function isServe(calls: readonly Invocation[]): boolean {
  return calls.some(({ call, script }) => SERVE.test(call) || (script !== null && /^serve\b/.test(script)))
}

// The API and one app.
const MAX_SERVES_AT_ONCE = 2

export function serveRefusal(running: number): string | null {
  return running < MAX_SERVES_AT_ONCE
    ? null
    : `${running} dev servers are already running (at most ${MAX_SERVES_AT_ONCE}: the API and one app). Stop one by its port first (fuser -k 4700/tcp).`
}

export function concurrencyRefusal(running: number): string | null {
  return running < MAX_HEAVY_AT_ONCE
    ? null
    : `${running} heavy commands are already running (at most ${MAX_HEAVY_AT_ONCE} at once). Wait for one to finish.`
}

/** A dev server start counts against the dev servers in `ps`, anything else against the heavy commands. */
export function runningRefusal(calls: readonly Invocation[], ps: string): string | null {
  return isServe(calls) ? serveRefusal(serveScopes(ps)) : concurrencyRefusal(heavyScopes(ps))
}

const RUNNER_WRITES: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?:^|[\s;&|(])git\s+(?:-[Cc]\s+\S+\s+|-\S+\s+)*(?:checkout|restore|reset|stash|clean|commit|push|rebase|revert|apply|cherry-pick|merge|switch|rm|mv|add)\b/, 'changes the working tree or git history'],
  [/(?:^|[\s;&|(])sed\s+(?:\S+\s+)*?(?:-[a-zA-Z]*i|--in-place)\b/, 'edits a file in place'],
  [/\s--(?:write|fix)(?:[=\s]|$)/, 'rewrites files'],
  [/(?:^|[\s;&|(])(?:systemctl\s+(?:--user\s+)?(?:start|stop|restart|kill|reset-failed)|systemd-run\s.*--unit|docker(?:\s+compose)?\s+(?:start|stop|restart|kill|rm|down|up)|pkill|killall|kill|fuser\s+-k)\b/, 'starts or stops a server or process'],
  [/(?:^|[^<>&\d])>>?(?!>)\s*(?!\/tmp\/|\/dev\/)[^\s&]/, 'writes a file outside /tmp'],
]
const FILE_WRITERS = ['tee', 'rm', 'touch', 'cp', 'mv']

/** Whether a tee, rm, touch, cp or mv names a path outside /tmp and /dev; a cp's source is only read. */
function writesOutsideTmp(command: string): boolean {
  return segments(command).some(part => {
    const [path = '', ...args] = words(part.replace(PREFIX, ''))
    const program = path.replace(/^.*\//, '')
    if (!FILE_WRITERS.includes(program)) {
      return false
    }
    const operands = args.filter((arg, i) => !/^-|^\d*[<>]/.test(arg) && !/^\d*[<>]+&?$/.test(args[i - 1] ?? ''))
    return operands.slice(program === 'cp' ? 1 : 0).some(arg => !/^['"]?\/(?:tmp|dev)\//.test(arg))
  })
}

/** A check-runner runs checks and reports; anything that changes files, git or servers is refused. */
export function checkRunnerRefusal(command: string): string | null {
  const reason = RUNNER_WRITES.find(([pattern]) => pattern.test(command))?.[1] ?? (writesOutsideTmp(command) ? 'writes a file outside /tmp' : null)
  return reason === null ? null : `a check-runner only runs checks: this command ${reason}. Report the failure instead of fixing it.`
}

