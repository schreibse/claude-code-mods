import { test, expect } from 'claude-code/testing'

import type { Task } from '../types'
import { backgroundIdOf, bar, duration, fit, memText, pairForeground, parsePs, progressOf, toolShells, treeOrder, treeRssKb } from './rules'

const SNAPSHOT = `/bin/bash -c source /home/me/.claude/shell-snapshots/snapshot-bash-1.sh 2>/dev/null || true && eval`
const PS = [
  `  100     1 50000 /home/me/.local/bin/claude`,
  `  200   100  4000 ${SNAPSHOT} 'sleep 120; echo done' < /dev/null`,
  `  201   200  1000 sleep 120`,
  `  300   100  4000 ${SNAPSHOT} 'pnpm exec jest --maxWorkers=2' < /dev/null`,
  `  301   300 900000 node jest`,
  `  302   301 800000 node jest-worker`,
  `  400   100  2000 sh -c echo probe`,
].join('\n')

const shell = (key: string, command: string): Task => ({ key, kind: 'shell', label: command, startedAt: 0, isBackground: false, command })

test('a shell counts its whole process tree; probes are not tool shells', () => {
  const rows = parsePs(PS)
  expect(toolShells(rows, 100).map(r => r.pid)).toEqual([200, 300])
  expect(treeRssKb(rows, 300)).toBe(1_704_000)
  expect(memText(treeRssKb(rows, 300))).toBe('1.6G')
  expect(memText(5000)).toBe('5M')
})

test('a background shell is named by the output file its stdout goes to', () => {
  expect(backgroundIdOf('/tmp/claude-1000/-home-me/abc/tasks/btpfg83dp.output\n')).toBe('btpfg83dp')
  expect(backgroundIdOf('pipe:[12345]')).toBeNull()
})

test('foreground calls pair with shells by command, then the one left over', () => {
  const rows = toolShells(parsePs(PS), 100)
  const byText = pairForeground([shell('a', 'pnpm exec jest --maxWorkers=2'), shell('b', 'sleep 120; echo done')], rows)
  expect(byText.get('a')).toBe(300)
  expect(byText.get('b')).toBe(200)
  const rewritten = pairForeground([shell('c', "it's rewritten beneath")], rows.slice(1))
  expect(rewritten.get('c')).toBe(300)
})

test('quotes in a command match the shell argv quoting', () => {
  const rows = parsePs(`  500   100 10 ${SNAPSHOT} 'echo '\\''hi'\\''' < /dev/null`)
  expect(pairForeground([shell('q', "echo 'hi'"), shell('r', 'other')], toolShells(rows, 100)).get('q')).toBe(500)
})

test('progress: nx task count, [N/M] counter, trailing percentage, else none', () => {
  const nx = ['', ' >  NX   Running target test for 4 projects:', '', '   ✔  nx run a:test (3s)', '   ✖  nx run b:test', '   \u001b[32m✔\u001b[39m  nx run c:test'].join('\n')
  expect(progressOf(nx)).toEqual({ done: 3, total: 4, unit: 'proj' })
  expect(progressOf('  ✓  [chromium] › a.spec.ts:3 [12/40]\n')).toEqual({ done: 12, total: 40, unit: '' })
  expect(progressOf('downloading\r 42%\r 57.5%')).toEqual({ percent: 57.5 })
  expect(progressOf('Today is 10/13, nothing to count')).toBeUndefined()
  expect(progressOf('99% done\nline\nline\nline\nlast')).toBeUndefined()
})

test('bar fills by progress and moves without it', () => {
  expect(bar({ done: 3, total: 4, unit: '' }, 0)).toBe('▰▰▰▰▰▰▰▰▱▱')
  expect(bar(undefined, 0)).toBe('▰▱▱▱▱▱▱▱▱▱')
  expect(bar(undefined, 2_000)).toBe('▱▱▰▱▱▱▱▱▱▱')
  expect(duration(40_000)).toBe('40s')
  expect(duration(192_000)).toBe('3m12s')
  expect(duration(3_725_000)).toBe('1h02m')
})

test('a long label is cut at a word and padded to the width', () => {
  expect(fit('check-runner: Registration e2e after login', 30)).toBe('check-runner: Registration…   ')
  expect(fit('short', 10)).toBe('short     ')
  expect(fit('averyveryverylongsinglewordlabel', 10)).toBe('averyvery…')
})

test("an agent's foreground shells follow it as children", () => {
  const agent = { key: 'a', kind: 'agent', label: 'check-runner: tests', startedAt: 0, isBackground: true, taskId: 'ag1' } as const
  const shell = { key: 's', kind: 'shell', label: 'Run jest', startedAt: 0, isBackground: false, agentId: 'ag1' } as const
  const other = { key: 'o', kind: 'shell', label: 'Run lint', startedAt: 0, isBackground: true } as const
  expect(treeOrder([shell, other, agent]).map(r => [r.task.key, r.isChild])).toEqual([['o', false], ['a', false], ['s', true]])
})
