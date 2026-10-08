import { test, expect } from 'claude-code/testing'
import { word } from './words'

test('each mode gets a plain word', () => {
  expect(word('thinking')).toBe('thinking')
  expect(word('tool-use')).toBe('running')
  expect(word('responding')).toBe('writing')
})

test('an unknown mode keeps its own name', () => {
  expect(word('compacting')).toBe('compacting')
})
