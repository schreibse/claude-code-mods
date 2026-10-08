import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { bar, decided, decisionOf, describe, positionOf, tally, walkFrom } from './rules'
import type { Walk } from '../types'

const walk = atom({ plugin: 'review-walk', key: 'walk' } as const, null)

function progress($: EngineInterface, e: Parameters<EngineInterface['ui']['resolve']>[0], current: Walk) {
  const { Box, Text } = $.ui.resolve(e)
  const done = decided(current)
  const total = current.findings.length
  const finding = current.asking === null ? null : (current.findings[current.asking] ?? null)
  return (
    <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="magenta">
      <Box>
        <Text color="magenta" bold>
          {finding === null ? 'Review walk ' : `Finding ${(current.asking ?? 0) + 1}/${total} `}
        </Text>
        <Text color="magenta">{bar(done, total)}</Text>
        <Text dimColor>{` ${done}/${total} decided · ${tally(current)}`}</Text>
      </Box>
      {finding !== null && <Text>{describe(finding)}</Text>}
      {finding === null && done === total && <Text dimColor>All decided; the closing report ends the walk.</Text>}
    </Box>
  )
}

export const register: Register = on => {
  on('tool.call', { tool: 'ReportFindings' }, async ($, e, next) => {
    const result = await next(e)
    if (!result.isError) {
      await update($, walk, () => walkFrom(e.findings)).catch(() => undefined)
    }
    return result
  })

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const question = e.questions[0]
    const index = positionOf(question?.header, await read($, walk).catch(() => null))
    if (index === null || question === undefined) {
      return next(e)
    }
    await update($, walk, w => (w === null ? w : { ...w, asking: index })).catch(() => undefined)
    const result = await next(e)
    const answers = ((result.result ?? {}) as { answers?: Record<string, string> }).answers ?? {}
    const decision = decisionOf(answers[question.question])
    await update($, walk, w => {
      if (w === null) {
        return w
      }
      const decisions = decision === null ? w.decisions : w.decisions.map((d, i) => (i === index ? decision : d))
      return { ...w, asking: null, decisions }
    }).catch(() => undefined)
    return result
  })

  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    const current = await read($, walk)
    const dialog = await next(e)
    if (current === null || current.asking === null) {
      return dialog
    }
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {progress($, e, current)}
        {dialog}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, walk)
    const band = await next(e)
    if (current === null || current.asking !== null || e.props.hasSurvey) {
      return band
    }
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {band}
        {progress($, e, current)}
      </Box>
    )
  })
}
