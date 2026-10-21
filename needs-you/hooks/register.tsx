import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { INSTRUCTION, MARKER, asksIn, segments } from './asks'
import { ASK_ICON, PICK_ICON, setToken } from './herdr'

const asks = atom({ plugin: 'needs-you', key: 'asks' } as const, [])

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    return { sections: [...result.sections, { id: 'needs-you', text: INSTRUCTION, scope: 'session' }] }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const found = asksIn(e.answer)
      await update($, asks, () => found)
      await setToken($, 'ask', found.length > 0 ? ASK_ICON : null)
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'composer' || e.origin.kind === 'bridge') {
      await update($, asks, () => [])
      await setToken($, 'ask', null)
    }
    return next(e)
  })

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    await setToken($, 'pick', PICK_ICON)
    try {
      return await next(e)
    } finally {
      await setToken($, 'pick', null)
    }
  })

  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    if (e.props.isSummary || !e.props.text.includes('Needs you:')) {
      return next(e)
    }
    const parts = segments(e.props.text)
    if (!parts.some(p => p.kind === 'ask')) {
      return next(e)
    }
    const { Box, Markdown, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {parts.map(p =>
          p.kind === 'ask' ? (
            <Text color="warning" bold>
              {MARKER} {p.text}
            </Text>
          ) : (
            <Markdown text={p.text} />
          ),
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const open = await read($, asks)
    if (e.props.hasSurvey || open.length === 0) {
      return next(e)
    }
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {open.map(text => (
          <Text color="warning" bold>
            {MARKER} {text}
          </Text>
        ))}
        <Button key="clear" label="Clear" onPress={async () => {
            await update($, asks, () => [])
            await setToken($, 'ask', null)
          }} />
      </Box>
    )
  })
}
