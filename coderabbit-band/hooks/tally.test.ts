import { test, expect } from 'claude-code/testing'
import { discussionsIn, fingerprint, isWorthShowing, openCount, severityOf, tallyOf } from './tally'

const RABBIT = { username: 'coderabbitai' }
const thread = (severity: string, resolved: boolean) => ({
  notes: [{ author: RABBIT, resolvable: true, resolved, body: `_🎯 Functional Correctness_ | _${severity}_ | _⚡ Quick win_\n\nbody` }],
})
const review = (body: string, created_at: string) => ({ notes: [{ author: RABBIT, resolvable: false, body, created_at }] })

test('severity comes from the thread header', () => {
  expect(severityOf('_🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_')).toBe('major')
  expect(severityOf('_🗄️ Data Integrity & Integration_ | _🟡 Minor_ | _⚡ Quick win_')).toBe('minor')
  expect(severityOf('_⚠️ Potential issue_\n\nold format')).toBe('other')
})

test('open threads per severity and the latest review’s nitpicks', () => {
  const tally = tallyOf(
    [
      thread('🟠 Major', false),
      thread('🟡 Minor', false),
      thread('🟡 Minor', true),
      review('**Actionable comments posted: 3**\n<summary>🧹 Nitpick comments (4)</summary>', '2026-10-01T10:00:00Z'),
      review('**Actionable comments posted: 1**\n<summary>🧹 Nitpick comments (2)</summary>', '2026-10-02T10:00:00Z'),
      { notes: [{ author: { username: 'someone' }, resolvable: true, resolved: false, body: 'human thread' }] },
    ],
    '!42',
    'https://gitlab.example.com/acme/shop/-/merge_requests/42',
  )
  expect(tally?.open).toEqual({ critical: 0, major: 1, minor: 1, trivial: 0, other: 0 })
  expect(tally?.nitpicks).toBe(2)
  expect(openCount(tally!)).toBe(2)
})

test('an MR CodeRabbit never touched gets no band', () => {
  expect(tallyOf([{ notes: [{ author: { username: 'someone' }, body: 'hi' }] }], '!1', 'https://x')).toBe(null)
})

test('all resolved and no nitpicks hides the band; a changed count shows it again', () => {
  const done = tallyOf([thread('🟡 Minor', true)], '!1', 'https://x')
  expect(isWorthShowing(done)).toBe(false)
  const one = tallyOf([thread('🟡 Minor', false)], '!1', 'https://x')!
  const two = tallyOf([thread('🟡 Minor', false), thread('🟠 Major', false)], '!1', 'https://x')!
  expect(fingerprint(one)).not.toBe(fingerprint(two))
})

test('every page’s discussions count, one per ndjson line', () => {
  const ndjson = [thread('🟠 Major', false), thread('🟡 Minor', false)].map(discussion => JSON.stringify(discussion)).join('\n') + '\n'
  expect(discussionsIn(ndjson)).toHaveLength(2)
  expect(openCount(tallyOf(discussionsIn(ndjson), '!1', 'https://x')!)).toBe(2)
  expect(discussionsIn('')).toEqual([])
})
