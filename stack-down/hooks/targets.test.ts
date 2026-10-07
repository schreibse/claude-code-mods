import { expect, test } from 'claude-code/testing'
import { composeIn, inside, isNx, isRepoRoot, parsePs, withDescendants } from './targets'

const ps = parsePs(`
  100     1 /usr/bin/bash -c npx nx serve api
  101   100 npm exec nx serve api
  102   101 node /repo/node_modules/.bin/../nx/dist/bin/nx.js serve api
  103   102 node dist/apps/api/main.js
  200     1 node ./node_modules/.bin/nx serve ec-members
  300     1 /usr/bin/syncthing serve --no-browser
  400     1 node /repo/tools/nginx.js
`)

test('finds nx however it was started, and nothing that only resembles it', () => {
  expect(ps.filter(isNx).map(p => p.pid)).toEqual([100, 101, 102, 200])
})

test('takes the workers a server started with it', () => {
  expect(withDescendants(ps, [102]).sort()).toEqual([102, 103])
})

test('a directory is inside the repo only on a path boundary', () => {
  expect(inside('/home/sts/Dev/retreats-hub/apps/api', '/home/sts/Dev/retreats-hub')).toBe(true)
  expect(inside('/home/sts/Dev/retreats-hub-old', '/home/sts/Dev/retreats-hub')).toBe(false)
})

test('brings down only the Compose projects whose files are in the repo', () => {
  const projects = [
    { Name: 'retreats-hub', ConfigFiles: '/home/sts/Dev/retreats-hub/compose.yaml' },
    { Name: 'khipu', ConfigFiles: '/home/sts/Dev/khipu/compose.yaml,/home/sts/Dev/khipu/compose.override.yaml' },
    { Name: 'old', ConfigFiles: '/home/sts/Dev/retreats-hub-old/compose.yaml' },
  ]
  expect(composeIn(projects, '/home/sts/Dev/retreats-hub')).toEqual(['retreats-hub'])
  expect(composeIn(projects, '/home/sts/Dev/khipu')).toEqual(['khipu'])
})

test('acts only for a session at a repo top level, never above the repos', () => {
  const ok = (stdout: string) => ({ exitCode: 0, stdout })
  expect(isRepoRoot(ok('/home/sts/Dev/retreats-hub\n'), '/home/sts/Dev/retreats-hub')).toBe(true)
  expect(isRepoRoot({ exitCode: 128, stdout: '' }, '/home/sts/Dev')).toBe(false)
  expect(isRepoRoot(ok('/home/sts/Dev/retreats-hub\n'), '/home/sts/Dev/retreats-hub/apps/api')).toBe(false)
})
