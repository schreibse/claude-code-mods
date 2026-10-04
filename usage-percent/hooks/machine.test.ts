import { test, expect } from 'claude-code/testing'
import { memory, pressureAvg10, servedProjects } from './machine'

test('memory shows slice usage, and pressure only when there is some', () => {
  expect(memory(3583266816, 12884901888, 0)).toBe('mem 3.3/12G')
  expect(memory(3583266816, 12884901888, 12.4)).toBe('mem 3.3/12G psi 12%')
  expect(memory(3583266816, 12884901888, 61)).toBe('mem 3.3/12G psi 61%▲')
  expect(memory(3583266816, Number('max'), 0)).toBe('mem 3.3G')
  expect(pressureAvg10('some avg10=7.25 avg60=0.00 avg300=0.00 total=1\nfull avg10=1.00')).toBe(7.25)
  expect(pressureAvg10('')).toBe(0)
})

test('served projects come from nx serve processes, once each', () => {
  const ps = [
    'npm exec nx serve api --host=0.0.0.0',
    'node /app/node_modules/.bin/nx serve api --host=0.0.0.0',
    'node ./node_modules/.bin/nx run admin:serve:development',
    'node ./node_modules/.bin/nx run admin:build',
    '/usr/bin/syncthing serve --no-browser',
  ].join('\n')
  expect(servedProjects(ps)).toEqual(['admin', 'api'])
})
