import { test, expect } from 'claude-code/testing'
import { READ_BLOCK, expandHome, isSameCall, isUnder, normalize, placeOf, see, shellWords, tagFor } from './rules'
import type { Verdict } from './rules'

const HOME = '/home/me'
const PLACE = placeOf({ home: HOME, root: '~/Dev', cwd: '/home/me/Dev/repo' })
const IN_DEV = placeOf({ home: HOME, root: '~/Dev', cwd: '/home/me/Dev' })
const paths = (tool: string, input: unknown, place = PLACE) => see(tool, input, place).paths
const bash = (command: string, place = PLACE) => paths('Bash', { command }, place)

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

test('the place: home normalized once, a relative root under ~, an absolute one kept', () => {
  expect(placeOf({ home: '/home/me/', root: 'Dev', cwd: '/x/' })).toEqual({ home: HOME, root: '/home/me/Dev', cwd: '/x', ignoredRoot: null })
  expect(placeOf({ home: HOME, root: '/srv/work', cwd: '/x' }).root).toBe('/srv/work')
  expect(see('Read', { file_path: '/home/me/.ssh/id' }, placeOf({ home: '/home/me/', root: 'Dev', cwd: '/x' })).label).toBe('~/.ssh/id')
})

test('a root that is empty, home or above it falls back to the default and is reported', () => {
  for (const root of ['', '  ', '~', '/', '/home']) {
    const place = placeOf({ home: HOME, root, cwd: '/x' })
    expect(place.root).toBe('/home/me/Dev')
    expect(place.ignoredRoot).toBe(root)
  }
})

test('the splitter honours quotes, escapes and operators', () => {
  expect(shellWords(`cat "$HOME"/.ssh/id 'a b' c\\ d && x|y`, HOME).tokens).toEqual([
    { word: 'cat' }, { word: '/home/me/.ssh/id' }, { word: 'a b' }, { word: 'c d' },
    { op: '&&' }, { word: 'x' }, { op: '|' }, { word: 'y' },
  ])
  expect(shellWords(`echo '~/x' "$HOME" '$HOME' "~/y"`, HOME).tokens).toEqual([{ word: 'echo' }, { word: '~/x' }, { word: HOME }, { word: '$HOME' }, { word: '~/y' }])
  expect(shellWords('echo >~/.log 2>/dev/null', HOME).tokens).toEqual([{ word: 'echo' }, { op: '>' }, { word: '/home/me/.log' }, { op: '2>' }, { word: '/dev/null' }])
})

test('inside double quotes a backslash escapes only $ ` " \\ and newline', () => {
  expect(bash('echo "\\$HOME/.ssh"')).toEqual([])
  expect(bash('cat "/home/me/a\\b"')).toEqual(['/home/me/a\\b'])
})

test('comments and heredoc bodies are not commands', () => {
  expect(bash("echo hi # don't\ncat ~/.ssh/id")).toEqual(['/home/me/.ssh/id'])
  expect(bash("cat <<'EOF' > /tmp/s.sh\nrm -rf /home/me/.cache\nEOF\ncat ~/.npmrc")).toEqual(['/home/me/.npmrc'])
  expect(bash('cat <<-END\n\t/home/me/.x\n\tEND\nls ~/.y')).toEqual(['/home/me/.y'])
  expect(bash('echo a#b ~/.z')).toEqual(['/home/me/.z'])
})

test('command substitutions are split as commands of their own', () => {
  expect(bash('cat `echo ~/.ssh/id`')).toEqual(['/home/me/.ssh/id'])
  expect(bash('echo "$(cat ~/.ssh/id)"')).toEqual(['/home/me/.ssh/id'])
  expect(bash('x=`ls ~`')).toEqual([HOME])
  expect(bash('cat $(echo x)/home/me/.a')).toEqual([])
  expect(bash('cat ~/$(echo .ssh)/id')).toEqual([HOME])
})

test('a -c script of a shell is split as a command', () => {
  expect(bash('bash -c "cat ~/.ssh/id"')).toEqual(['/home/me/.ssh/id'])
  expect(bash("/bin/sh -c 'cat ~/.aws/x'")).toEqual(['/home/me/.aws/x'])
  expect(bash('zsh -lc "ls ~/.zshrc"')).toEqual(['/home/me/.zshrc'])
  expect(bash('bash -c "/home/me/run.sh arg"')).toEqual(['/home/me/run.sh'])
})

test('~ before a redirect, and line continuations', () => {
  expect(bash('ls ~>/tmp/out')).toEqual([HOME])
  expect(bash('cat \\\n~/.ssh/id')).toEqual(['/home/me/.ssh/id'])
})

test('file tools: a path in ~ outside the root counts, the root and elsewhere do not', () => {
  expect(paths('Read', { file_path: '/home/me/.bashrc' })).toEqual(['/home/me/.bashrc'])
  expect(paths('Read', { file_path: '/home/me/Dev/repo/a.ts' })).toEqual([])
  expect(paths('Read', { file_path: '/etc/hosts' })).toEqual([])
  expect(paths('Edit', { file_path: '../../.config/x' })).toEqual(['/home/me/.config/x'])
  expect(paths('Grep', { pattern: 'home', path: '~/.claude' })).toEqual(['/home/me/.claude'])
  expect(paths('NotebookEdit', { notebook_path: '/home/me/n.ipynb' })).toEqual(['/home/me/n.ipynb'])
})

test('Glob: the pattern\'s literal start is resolved, against its path when given', () => {
  expect(paths('Glob', { pattern: '~/.ssh/*' })).toEqual(['/home/me/.ssh'])
  expect(paths('Glob', { pattern: '../../.ssh/*' })).toEqual(['/home/me/.ssh'])
  expect(paths('Glob', { pattern: './../../.ssh/*' })).toEqual(['/home/me/.ssh'])
  expect(paths('Glob', { pattern: 'a/../../../.aws/**' })).toEqual(['/home/me/.aws'])
  expect(paths('Glob', { pattern: '../*', path: '/home/me/Dev' })).toEqual([HOME])
  expect(paths('Glob', { pattern: '**/*.ts' })).toEqual([])
})

test('only the built-in file tools are read; MCP tools are left to the engine', () => {
  expect(paths('mcp__fs__read', { path: '~/.ssh/id' })).toEqual([])
  expect(paths('WebFetch', { url: 'https://x/home/me' })).toEqual([])
})

test('Bash: ~, $HOME, absolute and ../ words count, each path once', () => {
  expect(bash('cat ~/.ssh/id && ls $HOME/.config "/home/me/.npmrc"')).toEqual(['/home/me/.ssh/id', '/home/me/.config', '/home/me/.npmrc'])
  expect(bash('grep x ../../.bashrc; cat ~/.bashrc')).toEqual(['/home/me/.bashrc'])
  expect(bash('x=~/.aws; echo >~/.log')).toEqual(['/home/me/.aws', '/home/me/.log'])
  expect(bash('tool --config=/home/me/.toolrc')).toEqual(['/home/me/.toolrc'])
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

test('Bash: leading cds over && ; and newlines move the base, flags skipped', () => {
  expect(bash('ls ..', IN_DEV)).toEqual([HOME])
  expect(bash('cd .. && cat .ssh/id', IN_DEV)).toEqual([HOME])
  expect(bash('cd ~ && cat .bashrc')).toEqual([HOME])
  expect(bash('cd ~/Dev/a && cat ../../.npmrc')).toEqual(['/home/me/.npmrc'])
  expect(bash('cd /tmp && cd - && cat ../.npmrc', IN_DEV)).toEqual(['/home/me/.npmrc'])
  expect(bash('cd ~/.ssh; cat ../.aws/x')).toEqual(['/home/me/.ssh', '/home/me/.aws/x'])
  expect(bash('cd -P ~/.ssh && cat ../.aws/x')).toEqual(['/home/me/.ssh', '/home/me/.aws/x'])
  expect(bash('cd ~/Dev/a\ncat ../../.npmrc')).toEqual(['/home/me/.npmrc'])
  expect(bash('cd ~/x || cat ../.npmrc')).toEqual(['/home/me/x'])
})

test('Bash: the root, other users and mid-word tildes do not count', () => {
  expect(bash('ls ~/Dev/repo /home/me/Dev')).toEqual([])
  expect(bash('ls /home/other/x ~other/x')).toEqual([])
  expect(bash('git log a~2 HEAD~1')).toEqual([])
  expect(bash('echo "$HOMEBREW"')).toEqual([])
  expect(paths('Bash', {})).toEqual([])
})

test('Bash: a home outside /home is found by its literal path', () => {
  expect(bash('cat /Users/me/.zshrc /etc/hosts', placeOf({ home: '/Users/me', root: '~/Dev', cwd: '/Users/me/Dev' }))).toEqual(['/Users/me/.zshrc'])
})

test('the label: the first path under ~, else the command\'s start cut by character', () => {
  expect(see('Read', { file_path: '/home/me/.ssh/id' }, PLACE).label).toBe('~/.ssh/id')
  expect(see('Bash', { command: 'ls ~' }, PLACE).label).toBe('~')
  expect(see('Bash', { command: 'node  -e "x"' }, PLACE).label).toBe('node -e "x"')
  expect(see('Bash', { command: `${'x'.repeat(46)}😀😀😀` }, PLACE).label).toBe(`${'x'.repeat(46)}😀…`)
  expect(see('Read', { file_path: '/etc/hosts' }, PLACE).label).toBe('Read')
})

const HOME_READ = see('Read', { file_path: '/home/me/.bashrc' }, PLACE)
const tag = (verdict: Verdict, seen = HOME_READ) => tagFor(verdict, seen, PLACE)

test('core: allow is allowed, deny is blocked, nothing without a home path', () => {
  expect(tag({ decision: 'allow' })).toBe('allowed')
  expect(tag({ decision: 'deny' })).toBe('blocked')
  expect(tag({ decision: 'allow' }, see('Read', { file_path: '/etc/hosts' }, PLACE))).toBeNull()
})

test('"asked" only when the person saw a dialog; otherwise what became of the call', () => {
  expect(tag({ decision: 'ask', dialog: true })).toBe('asked')
  expect(tag({ decision: 'ask', dialog: true, didRun: true })).toBe('asked')
  expect(tag({ decision: 'ask', didRun: true })).toBe('allowed')
  expect(tag({ decision: 'ask', refused: true })).toBe('blocked')
  expect(tag({ decision: 'ask' })).toBeNull()
})

test('a verdict about something else is no home access, unless the call then ran', () => {
  expect(tag({ decision: 'deny', hook: 'PreToolUse' })).toBeNull()
  expect(tag({ decision: 'ask', plugin: 'pii-guard', dialog: true })).toBeNull()
  expect(tag({ decision: 'ask', plugin: 'pii-guard', dialog: true, didRun: true })).toBe('allowed')
  expect(tag({ decision: 'deny', setting: 'permissions.someOtherCheck' })).toBeNull()
  expect(tag({ decision: 'deny', setting: 'permissions.blockWritesOutsideWorkingDirectories' })).toBe('blocked')
})

test('a rule is home-caused when it names ~ or home as a whole path word', () => {
  expect(tag({ decision: 'deny', rule: 'Bash(rm:*)' })).toBeNull()
  expect(tag({ decision: 'deny', rule: 'Read(~/.bashrc)' })).toBe('blocked')
  expect(tag({ decision: 'deny', rule: 'Bash(cat ~:*)' })).toBe('blocked')
  expect(tag({ decision: 'deny', rule: 'Read(/home/me)' })).toBe('blocked')
  expect(tag({ decision: 'deny', rule: 'Read(//home/me/.ssh/**)' })).toBe('blocked')
  expect(tag({ decision: 'deny', rule: 'Read(/home/meow/x)' })).toBeNull()
})

test('the read block tags a Bash call whose path is hidden, never a file tool outside ~', () => {
  const hidden = see('Bash', { command: 'node script.js' }, PLACE)
  expect(tag({ decision: 'ask', setting: READ_BLOCK, dialog: true }, hidden)).toBe('asked')
  expect(tag({ decision: 'deny', setting: READ_BLOCK }, hidden)).toBe('blocked')
  expect(hidden.label).toBe('node script.js')
  expect(tag({ decision: 'ask', setting: READ_BLOCK, dialog: true }, see('Read', { file_path: '/etc/hosts' }, PLACE))).toBeNull()
})

test('a dialog is matched to its call by tool and input, key order aside', () => {
  expect(isSameCall({ tool: 'Bash', input: { command: 'ls', timeout: 1 } }, { tool: 'Bash', input: { timeout: 1, command: 'ls' } })).toBe(true)
  expect(isSameCall({ tool: 'Bash', input: { command: 'ls' } }, { tool: 'Bash', input: { command: 'ls -a' } })).toBe(false)
  expect(isSameCall({ tool: 'Read', input: { file_path: 'x' } }, { tool: 'Edit', input: { file_path: 'x' } })).toBe(false)
})
