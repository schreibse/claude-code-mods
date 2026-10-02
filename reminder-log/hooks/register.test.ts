import type { On } from 'claude-code'
import { test, expect } from 'claude-code/testing'
import { merge, record, report, shouldDrop } from './register'

// The test engine implements none of $.session.id, $.clock.now and $.store, so each hook test brings its own.
function stubSession(on: On) {
  const store = new Map<string, unknown>()
  on('session.id', () => ({ value: 'session-1' }))
  on('clock.now', () => ({ value: 0 }))
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
}

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

test('passes other reminders through unchanged', async ($, on) => {
  on('prompt.attachment', ($, e) => ({ text: e.text }))
  stubSession(on)
  const result = await $.prompt.attachment?.({ type: 'todo_reminder', text: 'remember the todos', origin: { kind: 'engine' } })
  expect(result).toEqual({ text: 'remember the todos' })
})

test('leaves the token counter out of the request', async ($, on) => {
  on('prompt.attachment', ($, e) => ({ text: e.text }))
  stubSession(on)
  const result = await $.prompt.attachment?.({ type: 'total_tokens_reminder', text: '<total_tokens>9 tokens left</total_tokens>', origin: { kind: 'engine' } })
  expect(result).toEqual({ text: null })
})

test('sends the attribution block once, then only when it changes', async ($, on) => {
  on('prompt.attachment', ($, e) => ({ text: e.text }))
  stubSession(on)
  const send = (text: string) => $.prompt.attachment?.({ type: 'remote_session_change', text, origin: { kind: 'engine' } })
  expect(await send('attribution A')).toEqual({ text: 'attribution A' })
  expect(await send('attribution A')).toEqual({ text: null })
  expect(await send('attribution B')).toEqual({ text: 'attribution B' })
})
