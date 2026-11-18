import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { DEFAULT_ROOT, READ_BLOCK, placeOf, requestedCall, sightingOf, tagFor } from './rules'
import type { Place, Tag, Verdict, Watched } from '../types'

const calls = atom({ plugin: 'home-watch', key: 'calls' } as const, {})
const pending = atom({ plugin: 'home-watch', key: 'pending' } as const, [])
const last = atom({ plugin: 'home-watch', key: 'last' } as const, null)
const problem = atom({ plugin: 'home-watch', key: 'problem' } as const, null)

const TAG_TEXT: Record<Tag, (isRunning: boolean) => string> = {
  blocked: () => 'BLOCKED',
  asked: isRunning => (isRunning ? 'ASKS YOU' : 'ASKED YOU'),
  allowed: () => 'allowed',
}
const TAG_COLOR: Record<Tag, 'error' | 'warning' | undefined> = { blocked: 'error', asked: 'warning', allowed: undefined }

async function placeHere($: EngineInterface, root: string): Promise<Place> {
  const place = placeOf({ home: (await $.env.get('HOME')) ?? '', root, cwd: await $.session.cwd() })
  await update($, problem, () => place.problem)
  return place
}

// Each fact the engine reports later is folded into the call's verdict, and the tag recomputed from it.
async function settle($: EngineInterface, id: string, change: Partial<Verdict>): Promise<void> {
  const watched = (await read($, calls))[id]
  if (watched === undefined) {
    return
  }
  const verdict = { ...watched.verdict, ...change }
  const tag = tagFor(verdict, watched.sighting, watched.home)
  await update($, calls, all => ({ ...all, [id]: { ...watched, verdict, tag } }))
  if (tag !== null && tag !== watched.tag) {
    await update($, last, () => ({ label: watched.sighting.label, tag }))
  }
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
    const place = await placeHere($, root)
    const sighting = sightingOf(e.tool, e.input, place)
    if (sighting.paths.length === 0 && !(e.tool === 'Bash' && result.setting === READ_BLOCK)) {
      return result
    }
    const id = e.tool_use_id
    const verdict: Verdict = {
      decision: result.decision,
      setting: result.setting,
      rule: result.rule,
      hook: result.hook,
      plugin: result.plugin,
      approver: e.approver,
    }
    const watched: Watched = { sighting, verdict, tag: null, home: place.home }
    await update($, calls, all => ({ ...all, [id]: watched }))
    if (result.decision === 'ask') {
      await update($, pending, list => [...list.filter(call => call.id !== id), { id, tool: e.tool, input: e.input, agentId: e.agentId }])
    }
    await settle($, id, {})
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
      await settle($, id, { dialog: true })
    }
    return result
  })

  on('classic.PermissionDenied', async ($, e, next) => {
    await forget($, e.tool_use_id)
    await settle($, e.tool_use_id, { refused: true })
    return next(e)
  })

  on('tool.run', async ($, e, next) => {
    await forget($, e.tool_use_id)
    await settle($, e.tool_use_id, { didRun: true })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const id = e.tool_use_id
    const watched = (await read($, calls))[id]
    await forget($, id)
    if (watched !== undefined && result.deny !== undefined && !next.signal.aborted && watched.verdict.didRun !== true) {
      await settle($, id, { refused: true })
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
    if (watched?.tag === undefined || watched.tag === null) {
      return row
    }
    const { Box, Text } = $.ui.resolve(e)
    const tag = watched.tag
    return (
      <Box flexDirection="column">
        {row}
        <Box paddingLeft={2}>
          <Text color={TAG_COLOR[tag]} dimColor={tag === 'allowed'} bold={tag !== 'allowed'}>{`⌂ ${TAG_TEXT[tag](e.props.isRunning)}`}</Text>
          <Text dimColor>{` ${watched.sighting.label}`}</Text>
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const others = await next(e)
    if (e.props.hasSurvey) {
      return others
    }
    const tags = Object.values(await read($, calls)).map(watched => watched.tag)
    const count = (tag: Tag) => tags.filter(t => t === tag).length
    const latest = await read($, last)
    const notice = await read($, problem)
    if (latest === null && notice === null) {
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
          {latest === null ? null : <Text dimColor>{` / last: ${latest.label} (${latest.tag})`}</Text>}
          {notice === null ? null : <Text color="warning">{` / ${notice}`}</Text>}
        </Box>
      </Box>
    )
  })
}
