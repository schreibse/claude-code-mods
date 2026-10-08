import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { bar, decide, decided, decisionOf, describe, isWalkSkill, positionOf, tally, walkFrom } from './rules'
import type { Decision, Walk } from '../types'

const walk = atom({ plugin: 'review-walk', key: 'walk' } as const, null)
const DECIDE = 'ReviewWalkDecide'
const DECISIONS = ['fix', 'issue', 'skip']

// The session whose review-walk skill ran last: only its reports start or end a walk.
let armedFor: string | null = null

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
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: DECIDE,
      description: 'Records review-walk decisions the user authorised without a question, so the walk band counts them. findings are the 1-based N of N/M.',
      inputSchema: {
        type: 'object',
        properties: {
          findings: { type: 'array', items: { type: 'integer', minimum: 1 }, minItems: 1 },
          decision: { type: 'string', enum: DECISIONS },
        },
        required: ['findings', 'decision'],
      },
    })
    return next(e)
  })

  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const result = await next(e)
    if (!result.isError && isWalkSkill(e.skill)) {
      armedFor = await $.session.id()
    }
    return result
  })

  on('command.run', async ($, e, next) => {
    if (isWalkSkill(e.command)) {
      armedFor = await $.session.id()
    }
    return next(e)
  })

  on('tool.call', { tool: 'ReportFindings' }, async ($, e, next) => {
    const result = await next(e)
    if (result.isError || armedFor === null || armedFor !== (await $.session.id())) {
      return result
    }
    const started = walkFrom(e.findings)
    if (started === null) {
      armedFor = null
    }
    await update($, walk, () => started).catch(() => undefined)
    return result
  })

  on('tool.call', { tool: /^mcp__review-walk__ReviewWalkDecide$/ }, async ($, e) => {
    const { findings, decision } = e as unknown as { findings?: unknown; decision?: unknown }
    if (!Array.isArray(findings) || typeof decision !== 'string' || !DECISIONS.includes(decision)) {
      return { deny: `${DECIDE} takes { findings: number[], decision: 'fix' | 'issue' | 'skip' }.` }
    }
    const updated = decide(await read($, walk), findings as number[], decision as Decision)
    if (typeof updated === 'string') {
      return { deny: updated }
    }
    await update($, walk, () => updated)
    return { result: `Recorded ${decision} for finding ${findings.join(', ')}; ${decided(updated)}/${updated.findings.length} decided.` }
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
