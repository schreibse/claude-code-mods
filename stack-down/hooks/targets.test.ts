import { expect, test } from 'claude-code/testing'
import { composeIn, inside, isClaude, isNx, isRepoRoot, nxOf, othersIn, parsePs, sessionOf, withDescendants } from './targets'

const ps = parsePs(`
  100     1 /usr/bin/bash -c npx nx serve api
  101   100 npm exec nx serve api
  102   101 node /repo/node_modules/.bin/../nx/dist/bin/nx.js serve api
  103   102 node dist/apps/api/main.js
  200     1 node ./node_modules/.bin/nx serve web
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
  expect(inside('/home/me/dev/notes/apps/api', '/home/me/dev/notes')).toBe(true)
  expect(inside('/home/me/dev/notes-old', '/home/me/dev/notes')).toBe(false)
})

test('brings down only the Compose projects whose files are in the repo', () => {
  const projects = [
    { Name: 'notes', ConfigFiles: '/home/me/dev/notes/compose.yaml' },
    { Name: 'shop', ConfigFiles: '/home/me/dev/shop/compose.yaml,/home/me/dev/shop/compose.override.yaml' },
    { Name: 'old', ConfigFiles: '/home/me/dev/notes-old/compose.yaml' },
  ]
  expect(composeIn(projects, '/home/me/dev/notes')).toEqual(['notes'])
  expect(composeIn(projects, '/home/me/dev/shop')).toEqual(['shop'])
})

test('acts only for a session at a repo top level, never above the repos', () => {
  const ok = (stdout: string) => ({ exitCode: 0, stdout })
  expect(isRepoRoot(ok('/home/me/dev/notes\n'), '/home/me/dev/notes')).toBe(true)
  expect(isRepoRoot({ exitCode: 128, stdout: '' }, '/home/me/dev')).toBe(false)
  expect(isRepoRoot(ok('/home/me/dev/notes\n'), '/home/me/dev/notes/apps/api')).toBe(false)
})

const sessions = parsePs(`
  500     1 /home/me/.local/bin/claude
  501   500 /bin/bash -c npx nx serve api
  502   501 node /repo/node_modules/.bin/../nx/dist/bin/nx.js serve api
  503   502 node dist/apps/api/main.js
  504   500 sh -c echo $PPID
  600     1 /home/me/.local/bin/claude
  601   600 node ./node_modules/.bin/nx serve web
  700     1 /home/me/.local/bin/claude --chrome-native-host
`)

test("finds the session's own Claude process up the hook command's ancestry", () => {
  expect(sessionOf(sessions, 504)).toBe(500)
  expect(sessionOf(sessions, 500)).toBe(500)
  expect(sessionOf(sessions, 999)).toBe(999)
  expect(sessions.filter(isClaude).map(p => p.pid)).toEqual([500, 600])
})

test("stops only the nx processes this session started, never another session's", () => {
  expect(nxOf(sessions, 500).sort()).toEqual([501, 502, 503])
  expect(nxOf(sessions, 600)).toEqual([601])
})

test('leaves Compose up while another session works inside the repo', () => {
  const claudes = [
    { pid: 500, cwd: '/home/me/dev/notes' },
    { pid: 600, cwd: '/home/me/dev/notes-old' },
  ]
  expect(othersIn(claudes, 500, '/home/me/dev/notes')).toBe(false)
  expect(othersIn([...claudes, { pid: 601, cwd: '/home/me/dev/notes/apps/api' }], 500, '/home/me/dev/notes')).toBe(true)
})
