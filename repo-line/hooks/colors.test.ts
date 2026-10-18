import { expect, test } from 'claude-code/testing'
import { hexOf, hueAt, parseColor, repoFacts } from './colors'

test('hues step by the golden angle from 200', () => {
  expect([0, 1, 2, 3].map(hueAt)).toEqual([200, 337.5, 115, 252.5])
})

test('a hue becomes a readable hex colour', () => {
  expect(hexOf(200)).toBe('#57afdb')
  expect(hexOf(0)).toBe('#db5757')
  expect(hexOf(115)).toBe('#62db57')
})

test('an override is a hex colour or a hue', () => {
  expect(parseColor('#FF8800')).toBe('#ff8800')
  expect(parseColor(' 200 ')).toBe('#57afdb')
  expect(parseColor('360')).toBeNull()
  expect(parseColor('red')).toBeNull()
  expect(parseColor('')).toBeNull()
})

test('name from the common git dir, worktree when the toplevel differs, short head when detached', () => {
  expect(repoFacts('/home/me/dev/khipu/.git', '/home/me/dev/khipu', 'main', 'abc1234')).toEqual({ name: 'khipu', worktree: null, branch: 'main' })
  expect(repoFacts('/home/me/dev/khipu/.git', '/home/me/dev/khipu-review', '', 'abc1234')).toEqual({ name: 'khipu', worktree: 'khipu-review', branch: '@abc1234' })
})
