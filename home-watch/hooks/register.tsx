import { atom, read, update } from 'claude-code'
import type { EngineInterface, Hook, Register } from 'claude-code'

import { DEFAULT_ROOT, isWatched, outcomeOf, placeOf, requestedCall, sightingOf, tagFor } from './rules'
import type { Outcome, Place, Tag, Verdict, Watched } from '../types'

type Render = Parameters<Hook<'ui.render'>>[1]

const calls = atom({ plugin: 'home-watch', key: 'calls' } as const, {})
const pending = atom({ plugin: 'home-watch', key: 'pending' } as const, [])
const last = atom({ plugin: 'home-watch', key: 'last' } as const, null)
const problem = atom({ plugin: 'home-watch', key: 'problem' } as const, null)

const TAG_TEXT: Record<Outcome, string> = {
  blocked: 'BLOCKED',
  allowed: 'allowed',
  waiting: 'ASKS YOU',
  approved: 'ASKED YOU · approved',
  declined: 'ASKED YOU · declined',
}
const TAG_COLOR: Record<Tag, 'error' | 'warning' | undefined> = { blocked: 'error', asked: 'warning', allowed: undefined }
const FACTS = ['dialog', 'refused', 'didRun', 'didEnd'] as const

async function placeOfSession($: EngineInterface, root: string): Promise<Place> {
  return placeOf({ home: (await $.env.get('HOME')) ?? '', root, cwd: await $.session.cwd() })
}

async function noteProblem($: EngineInterface, place: Place): Promise<void> {
  if ((await read($, problem)) !== place.problem) {
    await update($, problem, () => place.problem)
  }
}

async function foldIntoVerdict($: EngineInterface, id: string, change: Partial<Verdict>): Promise<void> {
  const home = placeOf({ home: (await $.env.get('HOME')) ?? '', root: DEFAULT_ROOT, cwd: '/' }).home
  const folded: { isChanged: boolean; tag: Tag | null } = { isChanged: false, tag: null }
  await update($, calls, all => {
    const current = all[id]
    folded.isChanged = false
    if (current === undefined) {
      return all
    }
    const verdict = { ...current.verdict, ...change }
    const tag = tagFor(verdict, current.sighting, home)
    folded.isChanged = tag !== current.tag
    folded.tag = tag
    return { ...all, [id]: { ...current, verdict, tag } }
  })
  if (folded.isChanged) {
    await update($, last, latest => (folded.tag !== null ? id : latest === id ? null : latest))
  }
}

function tagLine($: EngineInterface, e: Render, watched: Watched & { tag: Tag }) {
  const { Box, Text } = $.ui.resolve(e)
  const reason = watched.tag === 'blocked' ? watched.verdict.reason : undefined
  return (
    <Box paddingLeft={2}>
      <Text color={TAG_COLOR[watched.tag]} dimColor={watched.tag === 'allowed'}>{`⌂ ${TAG_TEXT[outcomeOf(watched.tag, watched.verdict)]}`}</Text>
      <Text dimColor wrap="truncate-end">{` ${watched.sighting.label}${reason === undefined ? '' : ` · ${reason}`}`}</Text>
    </Box>
  )
}

function isTagged(watched: Watched | undefined): watched is Watched & { tag: Tag } {
  return watched !== undefined && watched.tag !== null
}

async function forget($: EngineInterface, id: string): Promise<void> {
  await update($, pending, list => list.filter(call => call.id !== id))
}

export const register: Register = (on, options) => {
  const root = typeof options.root === 'string' ? options.root : DEFAULT_ROOT

  on('tool.check', async ($, e, next) => {
    const result = await next(e)
    if (e.tool_use_id === undefined) {
      return result
    }
    const place = await placeOfSession($, root)
    await noteProblem($, place)
    const sighting = sightingOf(e.tool, e.input, place)
    if (!isWatched(sighting, result.setting)) {
      return result
    }
    const id = e.tool_use_id
    const checked: Verdict = {
      decision: result.decision,
      setting: result.setting,
      rule: result.rule,
      hook: result.hook,
      plugin: result.plugin,
      reason: result.reason,
      approver: e.approver,
    }
    // A call checked again keeps what the engine reported about it since.
    await update($, calls, all => {
      const before = all[id]?.verdict
      const facts = Object.fromEntries(FACTS.flatMap(fact => (before?.[fact] === undefined ? [] : [[fact, before[fact]]])))
      return { ...all, [id]: { sighting, verdict: { ...checked, ...facts }, tag: all[id]?.tag ?? null } }
    })
    if (result.decision === 'ask') {
      await update($, pending, list => [...list.filter(call => call.id !== id), { id, tool: e.tool, input: e.input, agentId: e.agentId }])
    }
    await foldIntoVerdict($, id, {})
    return result
  })

  // A request no hook answered is the one the engine puts to the person as a dialog.
  on('classic.PermissionRequest', async ($, e, next) => {
    const result = await next(e)
    if (result.decision !== undefined) {
      return result
    }
    const id = requestedCall(await read($, pending), { tool: e.tool_name, input: e.tool_input, agentId: e.agent_id })
    if (id !== undefined) {
      await forget($, id)
      await foldIntoVerdict($, id, { dialog: true })
    }
    return result
  })

  on('classic.PermissionDenied', async ($, e, next) => {
    await forget($, e.tool_use_id)
    await foldIntoVerdict($, e.tool_use_id, { refused: true, reason: e.reason })
    return next(e)
  })

  on('tool.run', async ($, e, next) => {
    await forget($, e.tool_use_id)
    await foldIntoVerdict($, e.tool_use_id, { didRun: true })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const id = e.tool_use_id
    const watched = (await read($, calls))[id]
    await forget($, id)
    if (watched !== undefined) {
      const isRefused = result.deny !== undefined && !next.signal.aborted && watched.verdict.didRun !== true
      await foldIntoVerdict($, id, isRefused ? { didEnd: true, refused: true } : { didEnd: true })
    }
    return result
  })

  on('command.run', { command: 'clear' }, async ($, e, next) => {
    await update($, calls, () => ({}))
    await update($, pending, () => [])
    await update($, last, () => null)
    return next(e)
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const watched = (await read($, calls))[e.props.tool_use_id]
    const row = await next(e)
    if (!isTagged(watched)) {
      return row
    }
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {row}
        {tagLine($, e, watched)}
      </Box>
    )
  })

  // Unfolded, the group's rows are ToolUse rows: quiet-bash hands tagged ones down, so they draw their own tags.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const all = await read($, calls)
    const group = await next(e)
    const tagged = e.props.calls.map(call => (call.tool_use_id === undefined ? undefined : all[call.tool_use_id])).filter(isTagged)
    if (tagged.length === 0 || e.props.isExpanded) {
      return group
    }
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {group}
        {tagged.map(watched => tagLine($, e, watched))}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const others = await next(e)
    if (e.props.hasSurvey) {
      return others
    }
    const all = await read($, calls)
    const tags = Object.values(all).map(watched => watched.tag)
    const count = (tag: Tag) => tags.filter(t => t === tag).length
    const latestId = await read($, last)
    const latest = latestId === null ? undefined : all[latestId]
    const notice = await read($, problem)
    if (!isTagged(latest) && notice === null) {
      return others
    }
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {others}
        <Box>
          <Text>{'⌂ home '}</Text>
          <Text color="error">{`${count('blocked')} blocked`}</Text>
          <Text dimColor>{' · '}</Text>
          <Text color="warning">{`${count('asked')} asked`}</Text>
          <Text dimColor>{` · ${count('allowed')} allowed`}</Text>
          {isTagged(latest) ? <Text dimColor>{` / last: ${latest.sighting.label} (${outcomeOf(latest.tag, latest.verdict)})`}</Text> : null}
          {notice === null ? null : <Text color="warning">{` / ${notice}`}</Text>}
        </Box>
      </Box>
    )
  })
}
