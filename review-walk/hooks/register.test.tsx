import { test, expect } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const FINDINGS = [
  { file: 'src/a.ts', line: 3, summary: 'Null check missing on the parsed id', short_summary: 'Null check missing', failure_scenario: 'x', category: 'correctness' },
  { file: 'src/b.ts', summary: 'Query runs per row', failure_scenario: 'y' },
]

function engine($t: Parameters<TestBody>[0], on: Parameters<TestBody>[1], answer: string) {
  const duringQuestion: string[] = []
  on('tool.call', async (_, e) => {
    const call = e as { tool: string; questions?: { question: string }[] }
    if (call.tool !== 'AskUserQuestion') {
      return { isError: false, result: {} } as never
    }
    // The progress moves from the band onto the dialog while a walk's question is open.
    const shown = await (await band($t)).find({ type: 'Text', text: 'Review walk ' })
    duringQuestion.push(shown === undefined ? 'on the dialog' : 'in the band')
    return { isError: false, result: { answers: { [call.questions?.[0]?.question ?? '']: answer } } } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { duringQuestion }
}

const band = async ($: Parameters<TestBody>[0]) =>
  $.ui.mount({ plugin: 'review-walk', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false } as never })

const ask = (header: string) => ({
  tool: 'AskUserQuestion',
  questions: [{ question: 'Null check missing: fix it?', header, multiSelect: false, options: [{ label: 'Fix', description: '' }, { label: 'Skip', description: '' }] }],
})

test('a report starts the walk; each N/M answer moves the bar and the tally', async ($, on) => {
  const { duringQuestion } = engine($, on, 'Fix')
  expect(await (await band($)).find({ type: 'Text', text: ' 0/2 decided · fix 0 · issue 0 · skip 0' })).toBe(undefined)
  await $.tool.call({ tool: 'ReportFindings', findings: FINDINGS })
  expect(await (await band($)).find({ type: 'Text', text: ' 0/2 decided · fix 0 · issue 0 · skip 0' })).toBeDefined()
  await $.tool.call(ask('1/2'))
  expect(duringQuestion).toEqual(['on the dialog'])
  expect(await (await band($)).find({ type: 'Text', text: ' 1/2 decided · fix 1 · issue 0 · skip 0' })).toBeDefined()
})

test('the closing report with outcomes ends the walk', async ($, on) => {
  engine($, on, 'Fix')
  await $.tool.call({ tool: 'ReportFindings', findings: FINDINGS })
  await $.tool.call({ tool: 'ReportFindings', findings: FINDINGS.map(f => ({ ...f, outcome: 'fixed' })) })
  expect(await (await band($)).find({ type: 'Text', text: 'Review walk ' })).toBe(undefined)
})

test('a question outside the walk leaves it alone', async ($, on) => {
  const { duringQuestion } = engine($, on, 'Fix')
  await $.tool.call({ tool: 'ReportFindings', findings: FINDINGS })
  await $.tool.call(ask('Route'))
  expect(duringQuestion).toEqual(['in the band'])
  expect(await (await band($)).find({ type: 'Text', text: ' 0/2 decided · fix 0 · issue 0 · skip 0' })).toBeDefined()
})
