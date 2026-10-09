import { test, expect } from 'claude-code/testing'
import { MAX_AGE_MS, choicesFor, dropIndex, expandHome, handoverPath, isFresh, isPastedIn, sentenceOf, sessionIdOf, sessionPath, storeKey } from './rules'

test('the sentence is one line, without quote markers', () => {
  expect(sentenceOf('\n> PR #146 merged as 5fd98a4;\n> next is #132.\n')).toBe('PR #146 merged as 5fd98a4; next is #132.')
})

test('a sentence never starts with the bash-mode prefix', () => {
  expect(sentenceOf('!2376 merged as d655cdd004.')).toBe('MR !2376 merged as d655cdd004.')
  expect(sentenceOf('> !2376 merged.')).toBe('MR !2376 merged.')
  expect(sentenceOf('MR !2376 merged.')).toBe('MR !2376 merged.')
})

test('a handover is offered for two weeks', () => {
  expect(isFresh({ text: 'x', at: 0, root: '/r' }, MAX_AGE_MS - 1)).toBe(true)
  expect(isFresh({ text: 'x', at: 0, root: '/r' }, MAX_AGE_MS)).toBe(false)
  expect(isFresh({ text: '', at: 0, root: '/r' }, 1)).toBe(false)
  expect(isFresh(undefined, 1)).toBe(false)
})

test('paths and keys are per session', () => {
  expect(handoverPath('/home/me')).toBe('/home/me/.claude/handover.md')
  expect(sessionPath('/home/me', 's1')).toBe('/home/me/.claude/handovers/s1.md')
  expect(storeKey('s1')).toBe('handover:s1')
  expect(sessionIdOf('handover:s1')).toBe('s1')
  expect(sessionIdOf('other')).toBeNull()
  expect(expandHome('~/.claude/handover.md', '/home/me')).toBe('/home/me/.claude/handover.md')
  expect(expandHome('/r/~/x', '/home/me')).toBe('/r/~/x')
})

test('the choices are this root\'s fresh sentences, newest first', () => {
  const entry = (key: string, at: number, root = '/r/repo') => ({ key, handover: { text: key, at, root } })
  const entries = [entry('a', 10), entry('b', 30), entry('c', 20, '/r/other'), entry('d', -MAX_AGE_MS)]
  expect(choicesFor(entries, '/r/repo', 40).map(e => e.key)).toEqual(['b', 'a'])
})

test('a pasted sentence is found however it was rewrapped', () => {
  expect(isPastedIn('PR #146 merged\n  as 5fd98a4; next is #132.', 'PR #146 merged as 5fd98a4; next is #132.')).toBe(true)
  expect(isPastedIn('PR #146 merged as 5fd98a4.', 'PR #146 merged as 5fd98a4; next is #132.')).toBe(false)
  expect(isPastedIn('anything', '')).toBe(false)
})

test('/handover drop N names an entry, nothing else does', () => {
  expect(dropIndex('drop 2')).toBe(2)
  expect(dropIndex(' drop  10 ')).toBe(10)
  expect(dropIndex('2')).toBeNull()
  expect(dropIndex('drop')).toBeNull()
  expect(dropIndex('drop 0')).toBeNull()
  expect(dropIndex('drop 2x')).toBeNull()
})
