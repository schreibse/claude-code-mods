import { test, expect } from 'claude-code/testing'
import { MAX_AGE_MS, handoverPath, isFresh, sentenceOf, storeKey } from './rules'

test('the sentence is one line, without quote markers', () => {
  expect(sentenceOf('\n> PR #146 merged as 5fd98a4;\n> next is #132.\n')).toBe('PR #146 merged as 5fd98a4; next is #132.')
})

test('a sentence never starts with the bash-mode prefix', () => {
  expect(sentenceOf('!2376 merged as d655cdd004.')).toBe('MR !2376 merged as d655cdd004.')
  expect(sentenceOf('> !2376 merged.')).toBe('MR !2376 merged.')
  expect(sentenceOf('MR !2376 merged.')).toBe('MR !2376 merged.')
})

test('a handover is offered for two weeks', () => {
  expect(isFresh({ text: 'x', at: 0 }, MAX_AGE_MS - 1)).toBe(true)
  expect(isFresh({ text: 'x', at: 0 }, MAX_AGE_MS)).toBe(false)
  expect(isFresh({ text: '', at: 0 }, 1)).toBe(false)
  expect(isFresh(undefined, 1)).toBe(false)
})

test('paths and keys', () => {
  expect(handoverPath('/home/me')).toBe('/home/me/.claude/handover.md')
  expect(storeKey('/r/repo')).toBe('handover:/r/repo')
})
