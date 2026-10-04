import type { On } from 'claude-code'
import { test, expect } from 'claude-code/testing'
import { record } from './tally'

// The test engine implements none of $.session.id, $.clock.now and $.store, so each hook test brings its own.
function stubSession(on: On, store = new Map<string, unknown>(), now = 0) {
  on('session.id', () => ({ value: 'session-1' }))
  on('clock.now', () => ({ value: now }))
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
}

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

test('session start forgets tallies idle for 30 days and the old all-session tally', async ($, on) => {
  const store = new Map<string, unknown>([
    ['tally', record(undefined, 'a', 'engine', 'x', '2026-10-02T00:00:00Z')],
    ['tally:old', record(undefined, 'a', 'engine', 'x', '2026-09-01T00:00:00Z')],
    ['kept-attribution:old', 'attribution A'],
    ['tally:recent', record(undefined, 'a', 'engine', 'x', '2026-10-03T00:00:00Z')],
    ['kept-attribution:recent', 'attribution A'],
  ])
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  stubSession(on, store, Date.parse('2026-10-04T00:00:00Z'))
  await $.session.start?.({ cwd: '/', surface: null, isInteractive: false })
  expect([...store.keys()]).toEqual(['tally:recent', 'kept-attribution:recent'])
})
