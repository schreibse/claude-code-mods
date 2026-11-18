import { test, expect } from 'claude-code/testing'
import { READ_BLOCK, expandHome, homePaths, isUnder, label, normalize, rootDir, shellWords, tagFor } from './rules'

const HOME = '/home/me'
const AT = { home: HOME, root: '~/Dev', cwd: '/home/me/Dev/repo' }
const bash = (command: string, at = AT) => homePaths('Bash', { command }, at)

test('~ and $HOME expand only at the start of a path', () => {
  expect(expandHome('~', HOME)).toBe(HOME)
  expect(expandHome('~/.ssh', HOME)).toBe('/home/me/.ssh')
  expect(expandHome('$HOME/.ssh', HOME)).toBe('/home/me/.ssh')
  expect(expandHome('${HOME}/.ssh', HOME)).toBe('/home/me/.ssh')
  expect(expandHome('~other/x', HOME)).toBe('~other/x')
  expect(expandHome('$HOMEBREW/x', HOME)).toBe('$HOMEBREW/x')
})

test('normalize resolves . and .. against the cwd', () => {
  expect(normalize('../../.ssh', '/home/me/Dev/repo')).toBe('/home/me/.ssh')
  expect(normalize('/home/me/Dev/../.ssh/', '/x')).toBe('/home/me/.ssh')
  expect(normalize('./a/./b', '/c')).toBe('/c/a/b')
})

test('isUnder matches whole segments', () => {
  expect(isUnder('/home/me/Dev', '/home/me/Dev')).toBe(true)
  expect(isUnder('/home/me/Dev/x', '/home/me/Dev')).toBe(true)
  expect(isUnder('/home/me/Devices', '/home/me/Dev')).toBe(false)
})

test('a relative root lies under home, an absolute one stays', () => {
  expect(rootDir('Dev', HOME)).toBe('/home/me/Dev')
  expect(rootDir('~/Dev/', HOME)).toBe('/home/me/Dev')
  expect(rootDir('/srv/work', HOME)).toBe('/srv/work')
  expect(homePaths('Read', { file_path: '/home/me/Dev/other/a' }, { ...AT, root: 'Dev' })).toEqual([])
})

test('a home with a trailing slash still matches a bare ~', () => {
  expect(bash('ls ~', { ...AT, home: '/home/me/' })).toEqual([HOME])
})

test('the shell splitter honours quotes, escapes and operators', () => {
  expect(shellWords(`cat "$HOME"/.ssh/id 'a b' c\\ d && x|y`, HOME)).toEqual([
    { word: 'cat' }, { word: '/home/me/.ssh/id' }, { word: 'a b' }, { word: 'c d' },
    { op: '&&' }, { word: 'x' }, { op: '|' }, { word: 'y' },
  ])
  expect(shellWords(`echo '~/x' "$HOME" '$HOME'`, HOME)).toEqual([{ word: 'echo' }, { word: '~/x' }, { word: HOME }, { word: '$HOME' }])
  expect(shellWords('echo >~/.log 2>/dev/null', HOME)).toEqual([{ word: 'echo' }, { op: '>' }, { word: '/home/me/.log' }, { op: '2>' }, { word: '/dev/null' }])
})

test('file tools: a path in ~ outside the root counts, the root and elsewhere do not', () => {
  expect(homePaths('Read', { file_path: '/home/me/.bashrc' }, AT)).toEqual(['/home/me/.bashrc'])
  expect(homePaths('Read', { file_path: '/home/me/Dev/repo/a.ts' }, AT)).toEqual([])
  expect(homePaths('Read', { file_path: '/etc/hosts' }, AT)).toEqual([])
  expect(homePaths('Edit', { file_path: '../../.config/x' }, AT)).toEqual(['/home/me/.config/x'])
  expect(homePaths('Grep', { pattern: 'home', path: '~/.claude' }, AT)).toEqual(['/home/me/.claude'])
  expect(homePaths('NotebookEdit', { notebook_path: '/home/me/n.ipynb' }, AT)).toEqual(['/home/me/n.ipynb'])
})

test('Glob: patterns starting with ~, / or .. count, against its path when given', () => {
  expect(homePaths('Glob', { pattern: '~/.ssh/*' }, AT)).toEqual(['/home/me/.ssh/*'])
  expect(homePaths('Glob', { pattern: '../../.ssh/*' }, AT)).toEqual(['/home/me/.ssh/*'])
  expect(homePaths('Glob', { pattern: '../*', path: '/home/me/Dev' }, AT)).toEqual(['/home/me/*'])
  expect(homePaths('Glob', { pattern: '**/*.ts' }, AT)).toEqual([])
})

test('only the built-in file tools are read; MCP tools are left to the engine', () => {
  expect(homePaths('mcp__fs__read', { path: '~/.ssh/id' }, AT)).toEqual([])
  expect(homePaths('WebFetch', { url: 'https://x/home/me' }, AT)).toEqual([])
})

test('Bash: ~, $HOME, absolute and ../ words count, each path once', () => {
  expect(bash('cat ~/.ssh/id && ls $HOME/.config "/home/me/.npmrc"')).toEqual(['/home/me/.ssh/id', '/home/me/.config', '/home/me/.npmrc'])
  expect(bash('grep x ../../.bashrc; cat ~/.bashrc')).toEqual(['/home/me/.bashrc'])
  expect(bash('x=~/.aws; echo >~/.log')).toEqual(['/home/me/.aws', '/home/me/.log'])
  expect(bash('tool --config=/home/me/.toolrc')).toEqual(['/home/me/.toolrc'])
})

test('Bash: the review\'s splitting cases', () => {
  expect(bash('cat "$HOME"/.ssh/id')).toEqual(['/home/me/.ssh/id'])
  expect(bash('PATH=~/Dev/bin:~/.ssh ls')).toEqual(['/home/me/.ssh'])
  expect(bash('cat "/home/me/My Docs/x"')).toEqual(['/home/me/My Docs/x'])
  expect(bash("sed -e 's|/home/me/old|new|' f")).toEqual([])
})

test('Bash: remote and revision paths do not count, home itself does', () => {
  expect(bash('scp host:~/notes.txt .')).toEqual([])
  expect(bash('scp host:/home/me/x .')).toEqual([])
  expect(bash('git show HEAD:~/x')).toEqual([])
  expect(bash('echo $HOME')).toEqual([HOME])
})

test('Bash: a leading cd moves the base, and a cd into ~ counts itself', () => {
  const dev = { ...AT, cwd: '/home/me/Dev' }
  expect(bash('ls ..', dev)).toEqual([HOME])
  expect(bash('cd .. && cat .ssh/id', dev)).toEqual([HOME])
  expect(bash('cd ~ && cat .bashrc')).toEqual([HOME])
  expect(bash('cd ~/Dev/a && cat ../../.npmrc')).toEqual(['/home/me/.npmrc'])
  expect(bash('cd /tmp && cd - && cat ../.npmrc', dev)).toEqual(['/home/me/.npmrc'])
  expect(bash('cd ~/Dev/../.ssh')).toEqual(['/home/me/.ssh'])
})

test('Bash: the root, other users and mid-word tildes do not count', () => {
  expect(bash('ls ~/Dev/repo /home/me/Dev')).toEqual([])
  expect(bash('ls /home/other/x ~other/x')).toEqual([])
  expect(bash('git log a~2 HEAD~1')).toEqual([])
  expect(bash('echo "$HOMEBREW"')).toEqual([])
  expect(homePaths('Bash', {}, AT)).toEqual([])
})

test('Bash: a home outside /home is found by its literal path', () => {
  const mac = { home: '/Users/me', root: '~/Dev', cwd: '/Users/me/Dev' }
  expect(bash('cat /Users/me/.zshrc /etc/hosts', mac)).toEqual(['/Users/me/.zshrc'])
})

const PATHS = ['/home/me/.bashrc']

test('core\'s own check: deny blocks, a person\'s ask is asked, allow is allowed', () => {
  expect(tagFor({ decision: 'deny' }, PATHS, 'Read', HOME)).toBe('blocked')
  expect(tagFor({ decision: 'ask', approver: 'person' }, PATHS, 'Read', HOME)).toBe('asked')
  expect(tagFor({ decision: 'allow' }, PATHS, 'Read', HOME)).toBe('allowed')
  expect(tagFor({ decision: 'allow' }, [], 'Read', HOME)).toBeNull()
})

test('an ask nobody can answer is blocked; the classifier\'s verdict stands for it', () => {
  expect(tagFor({ decision: 'ask' }, PATHS, 'Read', HOME)).toBe('blocked')
  expect(tagFor({ decision: 'ask', approver: 'person', judged: 'allow' }, PATHS, 'Read', HOME)).toBe('allowed')
  expect(tagFor({ decision: 'ask', approver: 'person', judged: 'deny' }, PATHS, 'Read', HOME)).toBe('blocked')
  expect(tagFor({ decision: 'ask', approver: 'person', judged: 'ask' }, PATHS, 'Read', HOME)).toBe('asked')
})

test('a verdict about something else is no home access, unless the call then ran', () => {
  expect(tagFor({ decision: 'deny', hook: 'PreToolUse' }, PATHS, 'Bash', HOME)).toBeNull()
  expect(tagFor({ decision: 'ask', approver: 'person', plugin: 'pii-guard' }, PATHS, 'Bash', HOME)).toBeNull()
  expect(tagFor({ decision: 'ask', approver: 'person', plugin: 'pii-guard', ran: true }, PATHS, 'Bash', HOME)).toBe('allowed')
  expect(tagFor({ decision: 'deny', rule: 'Bash(rm:*)' }, PATHS, 'Bash', HOME)).toBeNull()
  expect(tagFor({ decision: 'deny', rule: 'Read(~/.bashrc)' }, PATHS, 'Read', HOME)).toBe('blocked')
  expect(tagFor({ decision: 'deny', rule: 'Read(/home/me/.bashrc)' }, PATHS, 'Read', HOME)).toBe('blocked')
})

test('the read block tags a Bash call whose path is hidden, never a file tool outside ~', () => {
  expect(tagFor({ decision: 'ask', setting: READ_BLOCK, approver: 'person' }, [], 'Bash', HOME)).toBe('asked')
  expect(tagFor({ decision: 'deny', setting: READ_BLOCK }, [], 'Bash', HOME)).toBe('blocked')
  expect(tagFor({ decision: 'ask', setting: READ_BLOCK, approver: 'person' }, [], 'Read', HOME)).toBeNull()
})

test('the band\'s label: the first path under ~, else the command\'s start', () => {
  expect(label(['/home/me/.ssh/id'], 'Read', {}, HOME)).toBe('~/.ssh/id')
  expect(label([HOME], 'Bash', {}, HOME)).toBe('~')
  expect(label([], 'Bash', { command: 'node  -e "x"' }, HOME)).toBe('node -e "x"')
  expect(label([], 'Bash', { command: 'x'.repeat(60) }, HOME)).toBe(`${'x'.repeat(47)}…`)
})
