import { atom, read, update } from 'claude-code'
import type { EngineInterface, Hook, Register } from 'claude-code'

import { cardFrom, isGh, kindOf, label, mergeRequestIn } from './cards'
import type { MrCard, MrKind } from '../types'

type Render = Parameters<Hook<'ui.render'>>[1]

const cards = atom({ plugin: 'mr-banner', key: 'cards' } as const, {})

const COLORS: Record<MrKind, string> = { created: 'green', merged: 'magenta', approved: 'cyan', reviewed: 'yellow' }
const ICONS: Record<MrKind, string> = { created: '✦', merged: '⛙', approved: '✔', reviewed: '✎' }

// Notes and approvals answer without the MR itself, so its link and title come from GitLab.
async function withMergeRequest($: EngineInterface, card: MrCard, input: Record<string, unknown>): Promise<MrCard> {
  if (card.url || input.project_id === undefined || input.merge_request_iid === undefined) {
    return card
  }
  const answer = await $.mcp.call('gitlab', 'get_merge_request', {
    project_id: input.project_id,
    merge_request_iid: input.merge_request_iid,
  })
  const block = answer.content.find(item => item.type === 'text')
  const mr = block && 'text' in block ? mergeRequestIn(String(block.text)) : null
  return mr ? { ...card, ...mr } : card
}

function drawCard($: EngineInterface, e: Render, card: MrCard) {
  const { Box, Link, Text } = $.ui.resolve(e)
  const color = COLORS[card.kind]
  return (
    <Box flexDirection="column" paddingLeft={2} marginY={1} borderStyle="round" borderColor={color}>
      <Box>
        <Text backgroundColor={color} color="black" bold> {ICONS[card.kind]} {label(card)} </Text>
        {card.ref ? <Text color={color} bold> {card.ref}</Text> : null}
        {card.title ? <Text wrap="truncate-end">  {card.title}</Text> : null}
      </Box>
      {card.url ? <Link href={card.url} /> : null}
    </Box>
  )
}

export const register: Register = on => {
  on('tool.call', async ($, e, next) => {
    // The GitLab MCP tools name their MR as project_id and merge_request_iid, untyped while no MCP tool is declared.
    const input: Record<string, unknown> = e
    const command = e.tool === 'Bash' ? e.command : ''
    const kind = kindOf(e.tool, command)
    const result = await next(e)
    if (kind === null || result.deny !== undefined || result.isError) {
      return result
    }
    try {
      const card = await withMergeRequest($, cardFrom(kind, result.text ?? '', input.merge_request_iid, isGh(command)), input)
      await update($, cards, all => ({ ...all, [e.tool_use_id]: card }))
    } catch (error) {
      $.ui.toast(`mr-banner: no card for ${e.tool} (${String(error)})`)
    }
    return result
  })

  // Wraps whatever draws the row beneath (quiet-bash's one-liner, or the engine's).
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const card = (await read($, cards))[e.props.tool_use_id]
    const row = await next(e)
    if (!card || e.props.isRunning) {
      return row
    }
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {row}
        {drawCard($, e, card)}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const all = await read($, cards)
    const found = e.props.calls.flatMap(call => {
      const card = call.tool_use_id && !call.isRunning ? all[call.tool_use_id] : undefined
      return card ? [card] : []
    })
    const row = await next(e)
    if (found.length === 0) {
      return row
    }
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {row}
        {found.map(card => drawCard($, e, card))}
      </Box>
    )
  })
}
