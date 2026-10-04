import { test, expect } from 'claude-code/testing'
import { containerOf, directoriesOf, memory, pressureAvg10, servedIn, serveProcesses } from './machine'

const text = (pieces: readonly { text: string }[]) => pieces.map(p => p.text).join('')

test('memory shows slice usage, coloured by its share, and pressure only when there is some', () => {
  expect(text(memory(3583266816, 12884901888, 0))).toBe('mem 3.3G')
  expect(memory(3583266816, 12884901888, 0)[1]?.tone).toBe('dim')
  expect(memory(10 * 1024 ** 3, 12884901888, 0)[1]?.tone).toBe('yellow')
  expect(text(memory(3583266816, 12884901888, 12.4))).toBe('mem 3.3G psi 12%')
  expect(memory(3583266816, 12884901888, 61)[3]?.tone).toBe('red')
  expect(text(memory(3583266816, Number('max'), 0))).toBe('mem 3.3G')
  expect(pressureAvg10('some avg10=7.25 avg60=0.00 avg300=0.00 total=1\nfull avg10=1.00')).toBe(7.25)
  expect(pressureAvg10('')).toBe(0)
})

test('serve processes come with their pid', () => {
  const ps = [
    '  56748 npm exec nx serve api --host=0.0.0.0',
    '  56855 node ./node_modules/.bin/nx run admin:serve:development',
    '  56900 node ./node_modules/.bin/nx run admin:build',
    '    812 /usr/bin/syncthing serve --no-browser',
  ].join('\n')
  expect(serveProcesses(ps)).toEqual([{ pid: '56748', project: 'api' }, { pid: '56855', project: 'admin' }])
})

test('only servers running in the session tree count, once each', () => {
  const processes = [
    { pid: '1', project: 'api' },
    { pid: '2', project: 'api' },
    { pid: '3', project: 'admin' },
    { pid: '4', project: 'web' },
    { pid: '5', project: 'gone' },
  ]
  const dirOf = directoriesOf('1: /r/repo\n2: /r/repo/apps/api\n3: /r/repo-other\n4: /r/other\n')
  expect(servedIn('/r/repo', processes, dirOf)).toEqual(['api'])
})

test('a containerised process names its container', () => {
  expect(containerOf('0::/system.slice/docker-ce8f5f6c.scope\n')).toBe('ce8f5f6c')
  expect(containerOf('0::/user.slice/user-1000.slice/session-2.scope\n')).toBeNull()
})
