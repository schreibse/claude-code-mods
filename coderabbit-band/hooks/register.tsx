import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import { ICONS, SEVERITIES, discussionsIn, fingerprint, isWorthShowing, openCount, tallyOf } from './tally'
import type { Tally } from '../types'

const TICK_MS = 60_000
const SHOWN_MS = 300_000
const QUIET_MS = 900_000
// CodeRabbit reviews a push within minutes, so poll every tick for a while after one.
const AFTER_PUSH_MS = 900_000
const AFTER_RESOLVE_MS = 5_000

const tally = atom({ plugin: 'coderabbit-band', key: 'tally' } as const, null)
const hiddenAt = atom({ plugin: 'coderabbit-band', key: 'hiddenAt' } as const, null)

type Poll = { root: string; branch: string; dueAt: number; fastUntil: number; isBusy: boolean }

const CODERABBIT_ORANGE = '#FF570A'
const HOSTS_WITHOUT_CODERABBIT = /github\.com|dev\.azure\.com|visualstudio\.com/

export function isGitPush(command: string): boolean {
  return /\bgit(?:\s+-[Cc]\s+\S+)*\s+push\b/.test(command)
}

async function fetchTally($: EngineInterface, root: string, branch: string): Promise<Tally | null> {
  const mr = await $.process.run(['glab', 'mr', 'view', branch, '-F', 'json'], { cwd: root, timeoutMs: 20_000 })
  if (mr.exitCode !== 0) {
    return null
  }
  const { iid, web_url, state } = JSON.parse(mr.stdout) as { iid: number; web_url: string; state: string }
  if (state !== 'opened') {
    return null
  }
  const notes = await $.process.run(
    ['glab', 'api', '--paginate', '--output', 'ndjson', `projects/:fullpath/merge_requests/${iid}/discussions?per_page=100`],
    { cwd: root, timeoutMs: 20_000 },
  )
  return notes.exitCode === 0 ? tallyOf(discussionsIn(notes.stdout), `!${iid}`, web_url) : null
}

async function tick($: EngineInterface, poll: Poll) {
  if (poll.isBusy) {
    return
  }
  poll.isBusy = true
  try {
    const branch = (await $.process.run(['git', 'branch', '--show-current'], { cwd: poll.root })).stdout.trim()
    const now = await $.clock.now()
    if (branch === poll.branch && now < poll.dueAt) {
      return
    }
    poll.branch = branch
    const found = branch === '' ? null : await fetchTally($, poll.root, branch).catch(() => null)
    await update($, tally, () => found)
    poll.dueAt = now + (now < poll.fastUntil ? TICK_MS : isWorthShowing(found) ? SHOWN_MS : QUIET_MS)
  } finally {
    poll.isBusy = false
  }
}

function startTick($: EngineInterface, poll: Poll): void {
  void tick($, poll).catch((error: unknown) => $.ui.log(`coderabbit-band: ${String(error)}`, { to: 'debug' }))
}

export const register: Register = on => {
  let poll: Poll | null = null
  let timer: Timer | null = null

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'coderabbit', description: 'Hide or show the CodeRabbit band' })
    timer?.cancel()
    timer = null
    poll = null
    const root = await $.session.root()
    const remote = await $.process.run(['git', 'remote', 'get-url', 'origin'], { cwd: root })
    if (remote.exitCode === 0 && !HOSTS_WITHOUT_CODERABBIT.test(remote.stdout)) {
      const current: Poll = { root, branch: '', dueAt: 0, fastUntil: 0, isBusy: false }
      poll = current
      startTick($, current)
      timer = $.clock.every(TICK_MS, () => startTick($, current))
    }
    return result
  })

  on('command.run', { command: 'coderabbit' }, async $ => {
    const shown = await read($, tally)
    if (!isWorthShowing(shown)) {
      return { text: 'No open CodeRabbit threads or nitpicks on this branch.' }
    }
    const isHidden = (await read($, hiddenAt)) === fingerprint(shown)
    await update($, hiddenAt, () => (isHidden ? null : fingerprint(shown)))
    return { text: isHidden ? 'CodeRabbit band shown.' : 'CodeRabbit band hidden until its counts change.' }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)
    const current = poll
    if (current !== null && isGitPush(e.command)) {
      const now = await $.clock.now()
      current.fastUntil = now + AFTER_PUSH_MS
      current.dueAt = now + TICK_MS
    }
    return result
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const current = poll
    // `@coderabbitai resolve` can go out through any GitLab MCP note tool or a glab command, so the whole call is searched.
    if (current !== null && (e.tool === 'mcp__gitlab__resolve_merge_request_thread' || /@coderabbitai resolve/.test(JSON.stringify(e)))) {
      current.dueAt = 0
      $.clock.after(AFTER_RESOLVE_MS, () => startTick($, current))
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = await read($, tally)
    const band = await next(e)
    if (e.props.hasSurvey || !isWorthShowing(shown) || (await read($, hiddenAt)) === fingerprint(shown)) {
      return band
    }
    const { Box, Link, Text } = $.ui.resolve(e)
    const open = openCount(shown)
    const counts = SEVERITIES.filter(severity => shown.open[severity] > 0).map(severity => `${ICONS[severity]} ${shown.open[severity]}`)
    return (
      <Box flexDirection="column">
        {band}
        <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor={CODERABBIT_ORANGE}>
          <Box>
            <Text>🐇 </Text>
            <Text backgroundColor={CODERABBIT_ORANGE} color="white" bold> CODERABBIT </Text>
            <Text color={CODERABBIT_ORANGE} bold> {shown.ref}</Text>
            <Text>  {open} open{counts.length > 0 ? ` · ${counts.join('  ')}` : ''}</Text>
            {shown.nitpicks > 0 ? <Text dimColor> · 🧹 {shown.nitpicks} nits</Text> : null}
            <Box flexGrow={1} />
            <Text dimColor>/coderabbit to hide</Text>
          </Box>
          <Link href={shown.url} />
        </Box>
      </Box>
    )
  })
}
