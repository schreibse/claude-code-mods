import { expect, test } from 'claude-code/testing'

import { asksIn, segments } from './asks'

test('marker lines split out, rest stays markdown', () => {
  const parts = segments('Done.\n\n⏸ Needs you: check the header on mobile\n- ⏸ Needs you: run `x`\nTail')
  expect(parts.map(p => p.kind)).toEqual(['markdown', 'ask', 'ask', 'markdown'])
  expect(parts[1]?.text).toBe('check the header on mobile')
})

test('marker inside a code fence is not an ask', () => {
  expect(asksIn('```\n⏸ Needs you: example\n```')).toEqual([])
})
