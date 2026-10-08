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

test('a Bash call seals its source file even behind more than ten words that are not files', async ($, on) => {
  const words = 'a b c d e f g h i j k'
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/h' }))
  on('session.cwd', () => ({ value: '/w' }))
  on('process.run', ($, e) => ({
    value: {
      ...RUN,
      exitCode: 0,
      stdout: e.argv[1] !== 'stdin' ? 'v1' : e.init?.stdin?.includes('AWS_KEY=') ? JSON.stringify([{ RuleID: 'aws-access-token', Secret: KEY }]) : '[]',
    },
  }))
  on('fs.stat', ($, e) => ({ value: { kind: e.path === '/w/.env' ? 'file' : 'other', size: 30, mtimeMs: 0, isLink: false } }))
  on('fs.read', () => ({ value: `AWS_KEY=${KEY}\n` }))
  on('tool.call', () => ({ result: '' }) as never)
  on('session.start', ($, e) => e as never)
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await $.session.start({ cwd: '/w', surface: null, isInteractive: false } as never)

  await $.tool.call({ tool: 'Bash', command: `cut -c1-60 ${words} .env` } as never)
  expect((await $.prompt.submit({ text: `seen ${KEY}`, wait: false, origin: { kind: 'sdk' } })).text).not.toContain(KEY)
})

test('a Write over an unreadable file still gets its tokens restored', async ($, on) => {
  const written: string[] = []
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/h' }))
  on('process.run', ($, e) => ({
    value: { ...RUN, exitCode: 0, stdout: e.argv[1] !== 'stdin' ? 'v1' : JSON.stringify([{ RuleID: 'aws-access-token', Secret: KEY }]) },
  }))
  on('fs.stat', () => ({ value: { kind: 'file', size: 10, mtimeMs: 0, isLink: false } }))
  on('fs.read', () => {
    throw new Error('EACCES')
  })
  on('tool.call', ($, e) => {
    written.push((e as { content: string }).content)
    return { result: '' } as never
  })
  on('session.start', ($, e) => e as never)
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await $.session.start({ cwd: '/w', surface: null, isInteractive: false } as never)
  const token = (await $.prompt.submit({ text: KEY, wait: false, origin: { kind: 'sdk' } })).text

  await $.tool.call({ tool: 'Write', file_path: '/w/locked', content: `AWS_KEY=${token}` } as never)
  expect(written).toEqual([`AWS_KEY=${KEY}`])
})
