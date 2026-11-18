import { test, expect } from 'claude-code/testing'
import { READ_BLOCK, expandHome, homePaths, isUnder, normalize, tagFor } from './rules'

const AT = { home: '/home/me', root: '~/Dev', cwd: '/home/me/Dev/repo' }

test('~ and $HOME expand only at the start of a path', () => {
  expect(expandHome('~', '/home/me')).toBe('/home/me')
  expect(expandHome('~/.ssh', '/home/me')).toBe('/home/me/.ssh')
  expect(expandHome('$HOME/.ssh', '/home/me')).toBe('/home/me/.ssh')
  expect(expandHome('${HOME}/.ssh', '/home/me')).toBe('/home/me/.ssh')
  expect(expandHome('~other/x', '/home/me')).toBe('~other/x')
  expect(expandHome('/r/~/x', '/home/me')).toBe('/r/~/x')
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

test('file tools: a path in ~ outside the root counts, the root and elsewhere do not', () => {
  expect(homePaths('Read', { file_path: '/home/me/.bashrc' }, AT)).toEqual(['/home/me/.bashrc'])
  expect(homePaths('Read', { file_path: '/home/me/Dev/repo/a.ts' }, AT)).toEqual([])
  expect(homePaths('Read', { file_path: '/etc/hosts' }, AT)).toEqual([])
  expect(homePaths('Edit', { file_path: '../../.config/x' }, AT)).toEqual(['/home/me/.config/x'])
  expect(homePaths('Grep', { pattern: 'home', path: '~/.claude' }, AT)).toEqual(['/home/me/.claude'])
  expect(homePaths('Glob', { pattern: '~/.ssh/*' }, AT)).toEqual(['/home/me/.ssh/*'])
  expect(homePaths('Glob', { pattern: '**/*.ts' }, AT)).toEqual([])
  expect(homePaths('NotebookEdit', { notebook_path: '/home/me/n.ipynb' }, AT)).toEqual(['/home/me/n.ipynb'])
})

test('Bash: ~, $HOME, /home/... and ../ words count, each path once', () => {
  expect(homePaths('Bash', { command: 'cat ~/.ssh/id && ls $HOME/.config "/home/me/.npmrc"' }, AT))
    .toEqual(['/home/me/.ssh/id', '/home/me/.config', '/home/me/.npmrc'])
  expect(homePaths('Bash', { command: 'grep x ../../.bashrc; cat ~/.bashrc' }, AT)).toEqual(['/home/me/.bashrc'])
  expect(homePaths('Bash', { command: 'cd ~/Dev/../.ssh' }, AT)).toEqual(['/home/me/.ssh'])
  expect(homePaths('Bash', { command: 'x=~/.aws; echo >~/.log' }, AT)).toEqual(['/home/me/.aws', '/home/me/.log'])
})

test('Bash: the root, other users and mid-word tildes do not count', () => {
  expect(homePaths('Bash', { command: 'ls ~/Dev/repo /home/me/Dev' }, AT)).toEqual([])
  expect(homePaths('Bash', { command: 'ls /home/other/x' }, AT)).toEqual([])
  expect(homePaths('Bash', { command: 'git log a~2 HEAD~1' }, AT)).toEqual([])
  expect(homePaths('Bash', { command: 'echo "$HOMEBREW"' }, AT)).toEqual([])
  expect(homePaths('Bash', {}, AT)).toEqual([])
  expect(homePaths('WebFetch', { url: 'https://x/home/me' }, AT)).toEqual([])
})

test('Bash: a home outside /home is found by its literal path', () => {
  const mac = { home: '/Users/me', root: '~/Dev', cwd: '/Users/me/Dev' }
  expect(homePaths('Bash', { command: 'cat /Users/me/.zshrc /etc/hosts' }, mac)).toEqual(['/Users/me/.zshrc'])
  expect(homePaths('Bash', { command: "sed -i 's/a/b/' f" }, mac)).toEqual([])
})

test('the root may be absolute', () => {
  expect(homePaths('Read', { file_path: '/home/me/work/a' }, { ...AT, root: '/home/me/work' })).toEqual([])
})

test('the tag follows the engine\'s verdict', () => {
  const paths = ['/home/me/.bashrc']
  expect(tagFor({ decision: 'deny' }, paths)).toBe('blocked')
  expect(tagFor({ decision: 'ask' }, paths)).toBe('asks')
  expect(tagFor({ decision: 'allow' }, paths)).toBe('allowed')
  expect(tagFor({ decision: 'allow' }, [])).toBeNull()
  expect(tagFor({ decision: 'deny' }, [])).toBeNull()
})

test('the read block tags a call whose path the classifier cannot see', () => {
  expect(tagFor({ decision: 'ask', setting: READ_BLOCK }, [])).toBe('asks')
  expect(tagFor({ decision: 'deny', setting: READ_BLOCK }, [])).toBe('blocked')
})
