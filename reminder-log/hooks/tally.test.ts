import { test, expect } from 'claude-code/testing'
import { merge, record, report, shouldDrop, staleKeys } from './tally'

test('counts and sizes each type, keeping the latest sample', () => {
  const one = record(undefined, 'todo_reminder', 'engine', 'first', 't1')
  const two = record(one, 'todo_reminder', 'engine', 'second  one', 't2')
  expect(two.since).toBe('t1')
  expect(two.types.todo_reminder).toEqual({ count: 2, chars: 16, origin: 'engine', sample: 'second one', lastSeen: 't2' })
})

test('counts drops per type', () => {
  const tally = record(record(undefined, 'total_tokens_reminder', 'engine', 'x', 't1', true), 'total_tokens_reminder', 'engine', 'y', 't2', true)
  expect(tally.types.total_tokens_reminder?.dropped).toBe(2)
})

test('reports the largest types first', () => {
  const tally = record(record(undefined, 'small', 'engine', 'x', 't'), 'big', 'hook', 'y'.repeat(400), 't')
  const lines = report(tally).split('\n')
  expect(lines[4]).toStartWith('| big | hook | 1 | 0 | ~100 |')
  expect(lines[5]).toStartWith('| small |')
})

test('says so when nothing was logged', () => {
  expect(report(undefined)).toBe('No reminders logged yet.')
})

test('merges per-session tallies: sums, earliest since, latest sample', () => {
  const a = record(undefined, 'skill_listing', 'engine', 'old', '2026-10-01T10:00')
  const b = record(record(undefined, 'skill_listing', 'engine', 'newer', '2026-10-02T10:00', true), 'only_b', 'engine', 'z', '2026-10-02T11:00')
  const merged = merge([a, b])
  expect(merged?.since).toBe('2026-10-01T10:00')
  expect(merged?.types.skill_listing).toEqual({ count: 2, chars: 8, origin: 'engine', sample: 'newer', lastSeen: '2026-10-02T10:00', dropped: 1 })
  expect(merged?.types.only_b?.count).toBe(1)
  expect(merge([])).toBeUndefined()
})

test('drops the token counter always and the attribution block only when unchanged', () => {
  expect(shouldDrop('total_tokens_reminder', '<total_tokens>1</total_tokens>', undefined)).toBe(true)
  expect(shouldDrop('remote_session_change', 'attribution A', undefined)).toBe(false)
  expect(shouldDrop('remote_session_change', 'attribution A', 'attribution A')).toBe(true)
  expect(shouldDrop('remote_session_change', 'attribution B', 'attribution A')).toBe(false)
  expect(shouldDrop('todo_reminder', 'x', 'x')).toBe(false)
})

test('a session tally is stale 30 days after its latest reminder, with its attribution twin', () => {
  const now = Date.parse('2026-11-10T12:00:00Z')
  const tallies = {
    'tally:old': record(record(undefined, 'a', 'engine', 'x', '2026-10-01T00:00:00Z'), 'b', 'engine', 'y', '2026-10-10T11:00:00Z'),
    'tally:recent': record(record(undefined, 'a', 'engine', 'x', '2026-09-01T00:00:00Z'), 'b', 'engine', 'y', '2026-10-11T13:00:00Z'),
  }
  expect(staleKeys(tallies, now)).toEqual(['tally:old', 'kept-attribution:old'])
})
