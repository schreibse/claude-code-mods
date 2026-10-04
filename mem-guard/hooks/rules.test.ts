import { test, expect } from 'claude-code/testing'
import { crowdedRefusal, invocations, isHeavy, parsePressure, refusal, scoped, segments } from './rules'

const GIB = 1024 ** 3
const shell = { cwd: '/repo', home: '/home/u' }
const scripts = { lint: 'nx lint', 'lint:affected': 'nx affected -t lint', 'lint:affected:lite': 'x', 'test:affected:lite': 'y', build: 'nx build' }
const refused = (command: string, inRepo: Record<string, string> = {}, from = shell) => refusal(invocations(command, from), { '/repo': inRepo })
const heavy = (command: string) => isHeavy(invocations(command, shell))

test('nx affected and run-many need --parallel=1', () => {
  expect(refused('npx nx affected -t lint')).toContain('--parallel=1')
  expect(refused('npx nx run-many -t test --parallel 3 --maxWorkers=2')).toContain('--parallel=1')
  expect(refused('pnpm run nx affected -t lint')).toContain('--parallel=1')
  expect(refused('npx nx affected -t lint --parallel=1')).toBeNull()
  expect(refused('npx nx affected -t lint --parallel 1')).toBeNull()
})

test('a pnpm script with a :lite sibling, or a prefix that has one, is refused', () => {
  expect(refused('pnpm run lint:affected', scripts)).toBe("use 'pnpm run lint:affected:lite' instead of 'lint:affected'.")
  expect(refused('pnpm test:affected', scripts)).toBe("use 'pnpm run test:affected:lite' instead of 'test:affected'.")
  expect(refused('pnpm --filter api run lint:affected', scripts)).toContain(':lite')
  expect(refused('pnpm run lint:affected:lite', scripts)).toBeNull()
  expect(refused('pnpm run build', scripts)).toBeNull()
})

test('the :lite lookup follows cd through the command', () => {
  const dev = { cwd: '/home/u/Dev', home: '/home/u' }
  const inRepo = (command: string) => refusal(invocations(command, dev), { '/home/u/Dev/repo': scripts })
  for (const command of ['cd ~/Dev/repo && pnpm run lint:affected', 'cd repo; pnpm test:affected', 'cd /tmp && cd "../home/u/Dev/./repo" && pnpm run lint:affected', '(cd repo && pnpm run lint:affected)']) {
    expect(inRepo(command)).toContain(':lite')
  }
  expect(inRepo('pnpm run lint:affected')).toBeNull()
  expect(inRepo('cd ~/Dev/repo && cd .. && pnpm run lint:affected')).toBeNull()
  expect(invocations('cd && cd - && cd x', { cwd: '/a', home: '/h' }).map(call => call.dir)).toEqual(['/h', '/h', '/h/x'])
})

test('ci:local is refused', () => {
  expect(refused('pnpm run ci:local')).toContain('pipeline')
  expect(refused('npm run ci:local')).toContain('pipeline')
})

test('pkill -f / pgrep -f need a bracketed pattern, also inside $( )', () => {
  for (const command of ['pkill -f "nx serve"', 'pgrep -af node', 'pgrep -fl node', 'pkill --full x', 'kill $(pgrep -f nx)', 'kill "$(pgrep -f nx)"', 'kill `pgrep -f nx`', 'pkill -f foo [x] bar']) {
    expect(refused(command)).toContain('wrapper')
  }
  expect(refused("pkill -f '[n]x serve'")).toBeNull()
  expect(refused('kill $(pgrep -f "[n]x serve")')).toBeNull()
  expect(refused('pgrep -x claude')).toBeNull()
  expect(refused('fuser -k 4700/tcp')).toBeNull()
})

test('jest runs, direct or as an nx test target, need a worker cap', () => {
  for (const command of ['pnpm exec jest src/a.spec.ts', 'npx jest', 'npx nx test api', 'npx nx run api:test --testPathPatterns=x', 'nx run-many -t lint,test --parallel=1', 'pnpm --filter api exec jest', 'pnpm -C x exec jest', 'node node_modules/.bin/jest', 'sleep 1 & npx jest', '( npx jest )', 'if true; then npx jest; fi', '{ npx jest; }']) {
    expect(refused(command)).toContain('--maxWorkers')
  }
  for (const command of ['npx nx test api --maxWorkers=2', 'pnpm exec jest --runInBand', 'npx jest -i', 'npx jest -w 2', 'npx jest --max-workers=2', 'npx jest --listTests', 'npx jest --version']) {
    expect(refused(command)).toBeNull()
  }
  for (const command of ['cat jest.config.ts', 'npx nx run app:test-e2e', 'npx nx lint api | grep test', 'npx nx build api --configuration=test']) {
    expect(refused(command)).toBeNull()
  }
})

test('bash -c and sh -c are checked inside', () => {
  expect(refused("bash -c 'npx nx run-many -t lint'")).toContain('--parallel=1')
  expect(refused('sh -c "cd sub && npx jest"')).toContain('--maxWorkers')
  expect(refused("bash -c 'cd /repo && pnpm run lint:affected'", scripts, { cwd: '/', home: '/h' })).toContain(':lite')
  expect(heavy("bash -c 'npx tsc -p .'")).toBe(true)
})

test('only what a segment runs counts, not words it mentions', () => {
  for (const command of ['git commit -m "refuse ci:local and bare jest, pkill -f x"', 'git commit -m "fix (pkill -f x)"', 'rg jest src', 'echo nx affected', 'grep -rn "pnpm run lint:affected" .', 'sed -n 1p jest.config.ts', "echo 'kill $(pgrep -f nx)'"]) {
    expect(refused(command, scripts)).toBeNull()
  }
  expect(refused('cat >> plan.md <<EOF\npnpm run ci:local\npkill -f nx\nEOF\necho done')).toBeNull()
  expect(refused("cat <<'EOF' > x\nnpx jest\nEOF\nnpx jest")).toContain('--maxWorkers')
  expect(heavy('git commit -m "npx tsc and nx build"')).toBe(false)
  expect(refused('cd app && FOO=1 timeout 60 pnpm exec jest x')).toContain('--maxWorkers')
  expect(refused('npx --no-install nx affected -t lint')).toContain('--parallel=1')
})

test('segments split on operators and substitutions, never inside quotes', () => {
  expect(segments('a && b || c; d | e & f')).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  expect(segments('echo "a && b" \'c; d\'')).toEqual(['echo "a && b" \'c; d\''])
  expect(segments('x "$(y z)" w')).toEqual(['x "', 'y z', '" w'])
})

test('heavy: builds, tests, typechecks, compose up; not nx show, a cat or a :lite script', () => {
  for (const command of ['npx nx build api', 'pnpm run typecheck', 'npx tsc -p .', 'docker compose -f x.yml up -d', 'npx playwright test']) {
    expect(heavy(command)).toBe(true)
  }
  for (const command of ['npx nx show projects --affected', 'cat tsconfig.json', 'docker compose ps', 'git status', 'pnpm run typecheck:lite', 'pnpm run lint:affected:lite']) {
    expect(heavy(command)).toBe(false)
  }
})

test('a full or pressured command slice refuses, with the numbers', () => {
  expect(crowdedRefusal({ usedBytes: 4 * GIB, maxBytes: 8 * GIB, psiAvg10: 0 })).toBeNull()
  expect(crowdedRefusal({ usedBytes: 6.5 * GIB, maxBytes: 8 * GIB, psiAvg10: 0 })).toContain('6.5/8G')
  expect(crowdedRefusal({ usedBytes: 2 * GIB, maxBytes: 8 * GIB, psiAvg10: 35 })).toContain('pressure 35%')
})

test('node commands are scoped once, leading cds stay outside, everything else is left alone', () => {
  const wrap = 'systemd-run --user --scope -q --slice=claude-cmd.slice --expand-environment=no -p MemoryMax=8G -p MemorySwapMax=1G -- bash -c'
  expect(scoped("pnpm exec jest -t 'it works'")).toBe(`${wrap} 'pnpm exec jest -t '\\''it works'\\'''`)
  expect(scoped('cd app && cd "my dir" && npx nx build api')).toBe(`cd app && cd "my dir" && ${wrap} 'npx nx build api'`)
  expect(scoped('npx tsc && cd x')).toBe(`${wrap} 'npx tsc && cd x'`)
  expect(scoped('cd app && git status')).toBe('cd app && git status')
  expect(scoped('git status')).toBe('git status')
  expect(scoped('rm -rf node_modules/.cache')).toBe('rm -rf node_modules/.cache')
  expect(scoped(scoped('cd a && npx nx build api'))).toBe(scoped('cd a && npx nx build api'))
})

test('cgroup files parse; an unlimited or unreadable slice gives no reading', () => {
  expect(parsePressure('4294967296\n', '8589934592\n', 'some avg10=12.50 avg60=0.00 avg300=0.00 total=1\nfull avg10=0.00')).toEqual({ usedBytes: 4 * GIB, maxBytes: 8 * GIB, psiAvg10: 12.5 })
  expect(parsePressure('1', 'max', 'some avg10=0.00')).toBeNull()
  expect(parsePressure('', '', '')).toBeNull()
})
