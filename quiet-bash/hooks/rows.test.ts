import { test, expect } from 'claude-code/testing'
import { THUMB_BOXES, diffStat, elapsed, failure, fit, isPipelineWaitTimeout, isQuietRead, keepsResult, pngPathsIn, shotMeta, shots, summary, thumbArgs } from './rows'

test('durations show only for slow calls', () => {
  expect(elapsed(undefined)).toBe('')
  expect(elapsed(9_499)).toBe('')
  expect(elapsed(12_400)).toBe('12s')
  expect(elapsed(102_000)).toBe('1m42s')
  expect(elapsed(3_605_000)).toBe('60m05s')
})

test('one-line summaries per tool', () => {
  expect(summary('Bash', { command: 'ls', description: 'List files' })).toBe('List files')
  expect(summary('Bash', {})).toBe('')
  expect(summary('Read', { file_path: '/home/me/x.ts', offset: 10, limit: 5 })).toBe('Read ~/x.ts:10-15')
  expect(summary('Edit', { file_path: '/r/.claude/plans/p.md' })).toBe('Updated plan p.md')
  expect(summary('Edit', { file_path: '/r/src/a.ts' })).toBe('Edit /r/src/a.ts')
  expect(summary('WebFetch', { url: 'https://code.claude.com/docs' })).toBe('Fetch code.claude.com/docs')
  expect(summary('mcp__claude_ai_Claude_Docs__read', { id: 'abc\nmore' })).toBe('Claude_Docs read: abc')
  expect(summary('AskUserQuestion', {})).toBeNull()
})

test('images are shots, other files are not', () => {
  expect(shots('SendUserFile', { files: ['/a/before.png', '/a/notes.md', '/a/after.jpg'], caption: 'before / after' }))
    .toEqual({ caption: 'before / after', files: ['/a/before.png', '/a/after.jpg'] })
  expect(shots('Read', { file_path: '/a/shot.webp' })).toEqual({ caption: 'shot.webp', files: ['/a/shot.webp'] })
  expect(shots('Read', { file_path: '/a/x.ts' })).toBeNull()
  expect(shots('SendUserFile', { files: ['/a/report.html'] })).toBeNull()
})

test('edit stats and failures', () => {
  expect(diffStat({ structuredPatch: [{ lines: [' a', '+b', '+c', '-d'] }] })).toBe('+2 −1')
  expect(diffStat({})).toBe('')
  expect(failure('Exit code 2\nboom')).toBe('exit 2')
})

test('shot header lists count, dimensions and total size', () => {
  expect(shotMeta([{ width: 1261, height: 817, bytes: 1_572_864 }, { width: 1500, height: 1736, bytes: 519_066 }]))
    .toBe('2 images · 1261×817, 1500×1736 · 2.0 MB')
  expect(shotMeta([null])).toBe('1 image')
})

test('shot results keep the engine drawing (clickable paths)', () => {
  expect(keepsResult('SendUserFile', {})).toBe(true)
  expect(keepsResult('Read', { type: 'image' })).toBe(true)
  expect(keepsResult('Read', { type: 'text' })).toBe(false)
  expect(keepsResult('Bash', {})).toBe(false)
})

test('reads are quiet: read tools always, others when the engine ran them read-only', () => {
  expect(isQuietRead('Read', false)).toBe(true)
  expect(isQuietRead('Grep', false)).toBe(true)
  expect(isQuietRead('Bash', true)).toBe(true)
  expect(isQuietRead('Bash', false)).toBe(false)
  expect(isQuietRead('Edit', false)).toBe(false)
})

test('only a failed pipeline wait is a timeout row', () => {
  expect(isPipelineWaitTimeout('MCP task kry26csj (gitlab/wait_for_pipeline) failed', 'failed')).toBe(true)
  expect(isPipelineWaitTimeout('MCP task kry26csj (gitlab/wait_for_pipeline) completed', 'completed')).toBe(false)
  expect(isPipelineWaitTimeout('MCP task ab12 (gitlab/wait_for_job) failed', 'failed')).toBe(false)
})

test('thumbnails keep their aspect ratio inside the box', () => {
  expect(fit({ width: 1050, height: 290 }, THUMB_BOXES.small)).toEqual({ columns: 40, rows: 6 })
  expect(fit({ width: 400, height: 1600 }, THUMB_BOXES.small)).toEqual({ columns: 5, rows: 10 })
  expect(fit({ width: 1920, height: 1080 }, THUMB_BOXES.large)).toEqual({ columns: 120, rows: 34 })
  expect(fit({ width: 1, height: 100_000 }, THUMB_BOXES.small)).toEqual({ columns: 1, rows: 10 })
})

test('PNG paths are found in tool text, once each', () => {
  const text = JSON.stringify({ command: 'magick a.jpg ~/shots/b.png && cp /tmp/c.png /tmp/c.png', out: 'saved to /home/me/x/d.PNG.' })
  expect(pngPathsIn(text, '/home/me')).toEqual(['/home/me/shots/b.png', '/tmp/c.png', '/home/me/x/d.PNG'])
  expect(pngPathsIn('no images here, notes.md', '/home/me')).toEqual([])
})

test('/thumb arguments pick the size and catch pasted images', () => {
  expect(thumbArgs(' /a/b.png ')).toEqual({ file: '/a/b.png', size: 'small' })
  expect(thumbArgs('big /a/b.png')).toEqual({ file: '/a/b.png', size: 'large' })
  expect(thumbArgs('[Image #5]')).toEqual({ pasted: true })
})
