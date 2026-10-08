import { test, expect } from 'claude-code/testing'

import { bar, decide, decisionOf, isWalkSkill, positionOf, tally, walkFrom } from './rules'

const reported = [
  { file: 'src/a.ts', line: 3, summary: 'Null check missing on the parsed id', short_summary: 'Null check missing', failure_scenario: 'x', category: 'correctness' },
  { file: 'src/b.ts', summary: 'Query runs per row', failure_scenario: 'y' },
]

test('a report without outcomes starts a walk, one with outcomes ends it', () => {
  const walk = walkFrom(reported)
  expect(walk?.findings).toEqual([
    { where: 'src/a.ts:3', category: 'correctness', label: 'Null check missing' },
    { where: 'src/b.ts', category: null, label: 'Query runs per row' },
  ])
  expect(walkFrom(reported.map(f => ({ ...f, outcome: 'fixed' })))).toBe(null)
  expect(walkFrom([])).toBe(null)
})

test('only an N/M header matching the walk\'s size is a position', () => {
  const walk = walkFrom(reported)
  expect(positionOf('2/2', walk)).toBe(1)
  expect(positionOf('2/3', walk)).toBe(null)
  expect(positionOf('3/2', walk)).toBe(null)
  expect(positionOf('Route', walk)).toBe(null)
  expect(positionOf('1/2', null)).toBe(null)
})

test('answers map to decisions by their first word', () => {
  expect(decisionOf('Fix now (Recommended)')).toBe('fix')
  expect(decisionOf('Issue')).toBe('issue')
  expect(decisionOf('skip')).toBe('skip')
  expect(decisionOf('only the rename please')).toBe('other')
  expect(decisionOf(undefined)).toBe(null)
})

test('the bar fills by share decided, and the tally counts each decision', () => {
  expect(bar(1, 4)).toBe('▓▓▓▓▓░░░░░░░░░░░░░░░')
  const walk = walkFrom(reported)!
  expect(tally({ ...walk, decisions: ['fix', 'other'] })).toBe('fix 1 · issue 0 · skip 0 · other 1')
})

test('only the review-walk skill arms a walk, as a user or a plugin skill', () => {
  expect(isWalkSkill('review-walk')).toBe(true)
  expect(isWalkSkill('review-walk:review-walk')).toBe(true)
  expect(isWalkSkill('code-review')).toBe(false)
  expect(isWalkSkill(undefined)).toBe(false)
})

test('decisions recorded without a question count, and only inside the walk', () => {
  const walk = walkFrom(reported)
  const decided = decide(walk, [1, 2], 'fix')
  expect(typeof decided === 'string' ? decided : decided.decisions).toEqual(['fix', 'fix'])
  expect(decide(walk, [3], 'skip')).toBe('Findings are numbered 1 to 2; got 3.')
  expect(decide(walk, [], 'skip')).toBe('Findings are numbered 1 to 2; got none.')
  expect(decide(null, [1], 'fix')).toBe('No review walk is active.')
})
