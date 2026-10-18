import { expect, test } from 'claude-code/testing'
import { scopedWindows } from './scoped'

const body = (limits: unknown) => JSON.stringify({ five_hour: { utilization: 32 }, limits })

test('the model-scoped weekly window, labelled by its model', () => {
  const limits = [
    { kind: 'session', group: 'session', percent: 32, resets_at: '2026-10-18T01:49:59Z', scope: null },
    { kind: 'weekly_all', group: 'weekly', percent: 30, resets_at: '2026-10-19T22:59:59Z', scope: null },
    { kind: 'weekly_scoped', group: 'weekly', percent: 28, resets_at: '2026-10-19T22:59:59Z', scope: { model: { id: null, display_name: 'Fable' }, surface: null } },
  ]
  expect(scopedWindows(body(limits))).toEqual([{ label: 'fable', percentUsed: 28, resetsAt: '2026-10-19T22:59:59Z' }])
})

test('a surface-scoped window, a missing list and a broken body give nothing', () => {
  expect(scopedWindows(body([{ kind: 'weekly_scoped', percent: 5, scope: { model: null, surface: 'cowork' } }]))).toEqual([])
  expect(scopedWindows(body(undefined))).toEqual([])
  expect(scopedWindows('<html>')).toEqual([])
})
