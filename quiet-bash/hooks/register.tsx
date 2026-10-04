import { atom, read, update } from 'claude-code'
import type { EngineInterface, Hook, Register } from 'claude-code'

import { MAX_IMAGE_SIDE, THUMB_BOXES, commandDir, diffStat, elapsed, failure, fit, isOversized, isPipelineWaitTimeout, isQuietRead, keepsResult, openFileUrl, pngPathsIn, shortPath, shotMeta, shots, summary, supersede, thumbArgs } from './rows'
import type { ShotInfo, ThumbSize } from './rows'
import type { Thumb } from '../types'

const infos = new Map<string, ShotInfo | null>()
const shrunk = new Map<string, string | null>()
const startedAt = new Map<string, number>()
const durations = new Map<string, number>()
const readOnly = new Set<string>()

type ToolUseRender = Extract<Parameters<Hook<'ui.render'>>[1], { component: 'ToolUse' }>
type TerminalRender = Extract<Parameters<Hook<'ui.render'>>[1], { surface: 'terminal' }>
type ToolCall = Parameters<Hook<'tool.call'>>[1]

const MAX_WRITTEN_THUMBS = 3

const isLoud = atom({ plugin: 'quiet-bash', key: 'isLoud' } as const, false)
// In session state, so a hot reload of this module keeps the thumbnails of rows already drawn.
const thumbs = atom({ plugin: 'quiet-bash', key: 'thumbs' } as const, {})

async function shotInfo($: EngineInterface, file: string, mtimeMs = 0): Promise<ShotInfo | null> {
  const key = `${file}@${mtimeMs}`
  if (!infos.has(key)) {
    infos.set(key, await identify($, file).catch(() => null))
  }
  return infos.get(key) ?? null
}

async function thumbOf($: EngineInterface, file: string, size: ThumbSize, since = 0): Promise<Thumb | null> {
  const stat = await $.fs.stat(file).catch(() => null)
  if (stat?.kind !== 'file' || stat.mtimeMs < since || !/\.png$/i.test(file)) {
    return null
  }
  const info = await shotInfo($, file, stat.mtimeMs)
  return info && { file, size, info, mtimeMs: stat.mtimeMs }
}

async function homeOf($: EngineInterface): Promise<string> {
  return (await $.env.get('HOME')) ?? ''
}

// Read and SendUserFile show the PNGs they name; any other call, MCP included, shows PNGs its text names that changed while it ran.
async function thumbsOf($: EngineInterface, call: ToolCall, result: unknown, since: number): Promise<Thumb[]> {
  const named = call.tool === 'Read' ? [call.file_path] : call.tool === 'SendUserFile' ? call.files : null
  if (named !== null) {
    const found = await Promise.all(named.map(file => thumbOf($, file, 'small')))
    return found.filter((thumb): thumb is Thumb => thumb !== null)
  }
  const home = await homeOf($)
  const cwd = await $.session.cwd()
  const dir = call.tool === 'Bash' ? commandDir(call.command, cwd, home) : cwd
  const found: Thumb[] = []
  for (const file of pngPathsIn(JSON.stringify([call, result]), dir, home)) {
    const thumb = found.length < MAX_WRITTEN_THUMBS ? await thumbOf($, file, 'small', since) : null
    if (thumb) {
      found.push(thumb)
    }
  }
  return found
}

async function shrink($: EngineInterface, file: string): Promise<string | null> {
  const side = `${MAX_IMAGE_SIDE}x${MAX_IMAGE_SIDE}>`
  const probe = await $.process.run(['magick', `${file}[0]`, '-resize', side, 'INLINE:PNG:-'])
  const png = probe.stdout.trim().replace(/^data:image\/png;base64,/, '')
  return probe.exitCode === 0 && !probe.isStdoutTruncated && png.length > 0 ? png : null
}

async function imageSource($: EngineInterface, thumb: Thumb) {
  const fromFile = { file: thumb.file, format: 'png', generation: Math.floor(thumb.mtimeMs) } as const
  if (!isOversized(thumb.info)) {
    return fromFile
  }
  const key = `${thumb.file}@${thumb.mtimeMs}`
  if (!shrunk.has(key)) {
    shrunk.set(key, await shrink($, thumb.file).catch(() => null))
  }
  const png = shrunk.get(key)
  return png ? { png } : fromFile
}

async function drawThumbs($: EngineInterface, e: TerminalRender, list: readonly Thumb[], home: string) {
  const { Box, Image, Link, Text } = $.ui.resolve(e)
  const room = Math.max(20, (e.viewport?.columns ?? 100) - 6)
  const drawn = await Promise.all(list.map(async thumb => ({ thumb, source: await imageSource($, thumb) })))
  return (
    <Box flexDirection="column" paddingLeft={2}>
      {drawn.map(({ thumb, source }) => {
        const box = THUMB_BOXES[thumb.size]
        return (
          <Box flexDirection="column">
            <Image
              source={source}
              {...fit(thumb.info, { columns: Math.min(box.columns, room), rows: box.rows })}
              alt={thumb.file}
            />
            <Text dimColor><Link href={openFileUrl(thumb.file)} label={shortPath(thumb.file, home)} />{` · ${thumb.info.width}`}×{thumb.info.height}</Text>
          </Box>
        )
      })}
    </Box>
  )
}

async function settle($: EngineInterface, id: string): Promise<number | undefined> {
  const start = startedAt.get(id)
  if (!durations.has(id) && start !== undefined) {
    durations.set(id, (await $.clock.now()) - start)
    startedAt.delete(id)
  }
  return durations.get(id)
}

async function identify($: EngineInterface, file: string): Promise<ShotInfo | null> {
  const probe = await $.process.run(['magick', 'identify', '-format', '%w %h %B', `${file}[0]`])
  const [width = 0, height = 0, size = 0] = probe.stdout.trim().split(' ').map(Number)
  return probe.exitCode === 0 && width > 0 ? { width, height, bytes: size } : null
}

async function toolRow($: EngineInterface, e: ToolUseRender, engineRow: () => ReturnType<Parameters<Hook<'ui.render'>>[2]>) {
  const { tool, input, isRunning, isErrored, isInterrupted, output } = e.props
  const title = summary(tool, input, await homeOf($))
  if (title === null || (await read($, isLoud))) {
    return engineRow()
  }

  const { Box, Text } = $.ui.resolve(e)
  const isFailed = isErrored && !isInterrupted
  const shot = isRunning || isFailed ? null : shots(tool, input)
  if (shot !== null && (await read($, thumbs))[e.props.tool_use_id]?.length === 0) {
    return <Box />
  }

  if (shot !== null) {
    const found = await Promise.all(shot.files.map(file => shotInfo($, file)))
    return (
      <Box>
        <Text color="cyan">  ◆ </Text>
        <Text bold wrap="truncate-end">{shot.caption}</Text>
        <Box flexGrow={1} />
        <Text dimColor>  {shotMeta(found)}</Text>
      </Box>
    )
  }

  const isDone = !isRunning && !isFailed && !isInterrupted
  if (isDone && (title === '' || isQuietRead(tool, readOnly.has(e.props.tool_use_id)))) {
    return <Box />
  }

  const took = isRunning ? '' : elapsed(await settle($, e.props.tool_use_id))
  const detail = isInterrupted ? 'interrupted' : isFailed ? failure(output) : tool === 'Edit' || tool === 'Write' ? diffStat(output) : ''
  const meta = [detail, took].filter(Boolean).join(' · ')

  return (
    <Box>
      {isFailed ? <Text color="red">  ✗ </Text> : <Text dimColor>  {isRunning ? '…' : isInterrupted ? '⊘' : '✓'} </Text>}
      <Text dimColor wrap="truncate-end">{title || tool}</Text>
      {meta ? <Text dimColor>  {meta}</Text> : null}
    </Box>
  )
}

export const register: Register = on => {

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'quiet', description: 'Toggle one-line tool rows' })
    await $.command.register({ name: 'thumb', description: 'Show a PNG inline: /thumb <path>, /thumb big <path>' })
    return next(e)
  })

  on('command.run', { command: 'quiet' }, async $ => {
    const loud = await update($, isLoud, value => !value)
    return { text: loud ? 'Full tool rows.' : 'One-line tool rows.' }
  })

  on('command.run', { command: 'thumb' }, async ($, e) => {
    const parsed = thumbArgs(e.args, await homeOf($))
    if ('pasted' in parsed) {
      return { text: 'A pasted path turns into an image attachment before /thumb sees it. Type the path instead of pasting it.' }
    }
    const thumb = await thumbOf($, parsed.file, parsed.size)
    if (!thumb) {
      return { text: `Not a readable PNG: ${parsed.file}` }
    }
    await update($, thumbs, all => ({ ...all, [`cmd:${e.args.trim()}`]: [thumb] }))
    return { text: `thumb: ${parsed.file}` }
  })

  on('tool.call', async ($, e, next) => {
    const since = await $.clock.now()
    startedAt.set(e.tool_use_id, since)
    try {
      const result = await next(e)
      if (result.isReadOnly) {
        readOnly.add(e.tool_use_id)
      }
      const found = await thumbsOf($, e, result, since).catch(() => [])
      if (found.length > 0) {
        await update($, thumbs, all => supersede(all, e.tool_use_id, found))
      }
      return result
    } finally {
      await settle($, e.tool_use_id)
      // The row may already have drawn as finished, before its duration and read-only flag were known.
      $.ui.invalidate('ui.render')
    }
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const row = await toolRow($, e, () => next(e))
    const list = e.props.isRunning ? undefined : (await read($, thumbs))[e.props.tool_use_id]
    if (!list || e.surface !== 'terminal' || (await read($, isLoud))) {
      return row
    }
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {row}
        {await drawThumbs($, e, list, await homeOf($))}
      </Box>
    )
  }).catch(($, e, next) => {
    $.ui.toast(`quiet-bash: ${e.props.tool} row failed (${next.error.kind}): ${next.error.message ?? 'no message'}`)
    return next(e)
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const { calls, isExpanded } = e.props
    const shown = await read($, thumbs)
    const hasThumb = (call: (typeof calls)[number]) => {
      const list = shown[call.tool_use_id ?? '']
      return list === undefined ? shots(call.tool, call.input) !== null : list.length > 0
    }
    if (calls.some(hasThumb)) {
      return next({ ...e, props: { ...e.props, isExpanded: true } })
    }
    if (isExpanded || calls.some(call => call.isErrored) || (await read($, isLoud))) {
      return next(e)
    }
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if ((await read($, thumbs))[e.props.tool_use_id] !== undefined && e.surface === 'terminal' && !(await read($, isLoud))) {
      const { Box } = $.ui.resolve(e)
      return <Box />
    }
    if (keepsResult(e.props.tool, e.props.output) || (await read($, isLoud))) {
      return next(e)
    }
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'CommandOutput', props: { command: 'thumb' } }, async ($, e, next) => {
    const list = (await read($, thumbs))[`cmd:${e.props.args.trim()}`]
    return list && e.surface === 'terminal' ? await drawThumbs($, e, list, await homeOf($)) : next(e)
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const { origin, task, text, isExpanded } = e.props
    if (origin.kind !== 'task-notification' || isExpanded || !isPipelineWaitTimeout(text, task?.status) || (await read($, isLoud))) {
      return next(e)
    }
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}
