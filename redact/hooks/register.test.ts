import { test, expect } from 'claude-code/testing'

const KEY = 'AKIAZ7Q3EXAMPLE4FAKE'
const RUN = { stderr: '', isStdoutTruncated: false, isStderrTruncated: false }

test('a failed or unreadable scan leaves only that prompt unredacted, the next one is scanned again', async ($, on) => {
  const toasts: string[] = []
  const statuses: (string | undefined)[] = []
  let scan: 'failing' | 'garbled' | 'ok' = 'failing'
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', ($, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('env.get', () => ({ value: '/h' }))
  on('process.run', ($, e) => ({
    value:
      e.argv[1] !== 'stdin'
        ? { ...RUN, exitCode: 0, stdout: 'v1' }
        : scan === 'failing'
          ? { ...RUN, exitCode: 2, stdout: '' }
          : scan === 'garbled'
            ? { ...RUN, exitCode: 0, stdout: 'not json' }
            : { ...RUN, exitCode: 0, stdout: JSON.stringify([{ RuleID: 'aws-access-token', Secret: KEY }]) },
  }))
  on('session.start', ($, e) => e as never)
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await $.session.start({ cwd: '/w', surface: null, isInteractive: false } as never)
  const submit = (text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'sdk' } })

  expect((await submit(`key ${KEY}`)).text).toContain(KEY)
  expect((await submit(`again ${KEY}`)).text).toContain(KEY)
  expect(toasts).toEqual(['betterleaks failed, this output is NOT redacted'])
  expect(statuses.at(-1)).toBe('off (betterleaks)')

  scan = 'ok'
  expect((await submit(`key ${KEY}`)).text).not.toContain(KEY)
  expect(statuses.at(-1)).toBe('redacted 1')

  scan = 'garbled'
  expect((await submit(`known ${KEY}`)).text).not.toContain(KEY)
  expect(toasts.filter(text => text.startsWith('betterleaks failed'))).toHaveLength(2)
})
