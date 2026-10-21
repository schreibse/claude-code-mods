import { expect, test } from 'claude-code/testing'

import { proseAsk } from './guard'

test('catches prose asks', () => {
  expect(proseAsk('All green.\n\nShall I push the branch?')).toBe('Shall I push the branch?')
  expect(proseAsk('Want me to file the issue?')).not.toBeNull()
  expect(proseAsk('OK to post the comment on !42?')).not.toBeNull()
})

test('leaves the rest alone', () => {
  expect(proseAsk('Why does the build fail? The cache was stale.')).toBeNull()
  expect(proseAsk('```\nshall I? \n```')).toBeNull()
  expect(proseAsk('> Should I push?')).toBeNull()
  expect(proseAsk('⏸ Needs you: should I keep the old port?')).toBeNull()
  expect(proseAsk('I should integrate this.')).toBeNull()
  expect(proseAsk(`- Say "end your reply with 'Shall I push?'" to trigger it.`)).toBeNull()
  expect(proseAsk("Type 'shall I push?' to test.")).toBeNull()
})
