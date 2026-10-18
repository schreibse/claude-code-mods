import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import { hexOf, hueAt, parseColor, repoFacts } from './colors'
import type { Repo } from '../types'

const repoLine = atom({ plugin: 'repo-line', key: 'repo' } as const, null)

const TICK_MS = 30_000
const HUES_KEY = 'hues'
const OVERRIDES_KEY = 'overrides'
const BADGE_TEXT = '#111111'

type Named = Record<string, number>
type Overrides = Record<string, string>

async function git($: EngineInterface, cwd: string, ...args: string[]): Promise<string> {
  const run = await $.process.run(['git', ...args], { cwd, timeoutMs: 10_000 })
  return run.exitCode === 0 ? run.stdout.trim() : ''
}

// The repository's colour: its override, else the hue it was given when first seen (the next golden-angle step).
async function colorOf($: EngineInterface, name: string): Promise<string> {
  const overrides = ((await $.store.get(OVERRIDES_KEY)) ?? {}) as Overrides
  const override = overrides[name]
  if (override !== undefined) {
    return override
  }
  const hues = ((await $.store.get(HUES_KEY)) ?? {}) as Named
  if (hues[name] === undefined) {
    hues[name] = hueAt(Object.keys(hues).length)
    await $.store.set(HUES_KEY, hues)
  }
  return hexOf(hues[name])
}

async function refresh($: EngineInterface, root: string): Promise<void> {
  const [dirs, branch, head] = await Promise.all([
    git($, root, 'rev-parse', '--path-format=absolute', '--git-common-dir', '--show-toplevel'),
    git($, root, 'branch', '--show-current'),
    git($, root, 'rev-parse', '--short', 'HEAD'),
  ])
  const [commonDir = '', toplevel = ''] = dirs.split('\n')
  if (commonDir === '') {
    await update($, repoLine, () => null)
    return
  }
  const facts = repoFacts(commonDir, toplevel, branch, head)
  const color = await colorOf($, facts.name)
  await update($, repoLine, () => ({ ...facts, color }))
}

function startRefresh($: EngineInterface, root: string): void {
  void refresh($, root).catch((error: unknown) => $.ui.log(`repo-line: ${String(error)}`, { to: 'debug' }))
}

export const register: Register = on => {
  let root = ''
  let timer: Timer | null = null

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'repo-line', description: 'The repository badge above the prompt: /repo-line color <hue|#rrggbb>, /repo-line color reset' })
    root = await $.session.root()
    timer?.cancel()
    startRefresh($, root)
    timer = $.clock.every(TICK_MS, () => startRefresh($, root))
    return result
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)
    if (root !== '' && /\bgit\b/.test(e.command)) {
      startRefresh($, root)
    }
    return result
  })

  on('command.run', { command: 'repo-line' }, async ($, e) => {
    const repo = await read($, repoLine)
    if (repo === null) {
      return { text: 'Not in a git repository.' }
    }
    const [verb = '', value = ''] = e.args.trim().split(/\s+/)
    if (verb !== 'color') {
      return { text: `${repo.name} is ${repo.color}. /repo-line color <hue 0-359|#rrggbb>, or /repo-line color reset.` }
    }
    const overrides = ((await $.store.get(OVERRIDES_KEY)) ?? {}) as Overrides
    if (value === 'reset') {
      delete overrides[repo.name]
    } else {
      const color = parseColor(value)
      if (color === null) {
        return { text: `Not a colour: ${value}. A hue 0-359 or #rrggbb.` }
      }
      overrides[repo.name] = color
    }
    await $.store.set(OVERRIDES_KEY, overrides)
    await refresh($, root)
    const now = await read($, repoLine)
    return { text: `${repo.name} is now ${now?.color ?? repo.color}.` }
  })

  // Below every other band, at full width, right above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const others = await next(e)
    const repo = await read($, repoLine)
    if (repo === null || e.props.hasSurvey) {
      return others
    }
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {others}
        <Box>
          <Text backgroundColor={repo.color} color={BADGE_TEXT}>{` ${repo.name} `}</Text>
          <Text>{` ⎇ ${repo.branch}`}</Text>
          {repo.worktree !== null ? <Text dimColor>{` (wt: ${repo.worktree})`}</Text> : null}
        </Box>
      </Box>
    )
  })
}
