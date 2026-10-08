import { test, expect } from 'claude-code/testing'
import { isGitPush } from './register'

test('a push counts with -C or -c options before it', () => {
  expect(isGitPush('git push')).toBe(true)
  expect(isGitPush('cd x && git -C ../repo push -u origin HEAD')).toBe(true)
  expect(isGitPush('git -c core.sshCommand=ssh -C /r/repo push')).toBe(true)
  expect(isGitPush('git pushx')).toBe(false)
  expect(isGitPush('git log --grep push')).toBe(false)
})
