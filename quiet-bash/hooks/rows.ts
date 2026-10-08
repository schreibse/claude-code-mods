import type { Thumb, Thumbs } from '../types'

const PLAN_FILE = /\/\.claude\/plans\/[^/]+$/
const IMAGE_FILE = /\.(png|jpe?g|gif|webp)$/i

export type ShotInfo = { width: number; height: number; bytes: number }

export function keepsResult(tool: string, output: unknown): boolean {
  return ENGINE_DRAWN.has(tool) || tool === 'SendUserFile' || (tool === 'Read' && (output as { type?: string } | undefined)?.type === 'image')
}

function bytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

export function shotMeta(infos: readonly (ShotInfo | null)[]): string {
  const known = infos.filter((info): info is ShotInfo => info !== null)
  const count = infos.length === 1 ? '1 image' : `${infos.length} images`
  if (known.length === 0) {
    return count
  }
  const dims = known.map(info => `${info.width}×${info.height}`).join(', ')
  return `${count} · ${dims} · ${bytes(known.reduce((sum, info) => sum + info.bytes, 0))}`
}

const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS'])
// Browser steps come in dozens per task; only navigate says where the browser went.
const BROWSER_STEP = /^mcp__claude-in-chrome__(?!navigate$)/

export function isQuietRead(tool: string, isFlaggedReadOnly: boolean): boolean {
  return isFlaggedReadOnly || READ_TOOLS.has(tool) || BROWSER_STEP.test(tool)
}

const ENGINE_DRAWN = new Set(['AskUserQuestion', 'ExitPlanMode', 'EnterPlanMode', 'TodoWrite'])

type Fields = {
  command?: string
  description?: string
  file_path?: string
  offset?: number
  limit?: number
  url?: string
  query?: string
  skill?: string
  files?: string[]
  caption?: string
}

export function shortPath(path: string, home: string): string {
  return home !== '' && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path
}

// herdr's ctrl+click ignores file:// and a `Link` takes only https or localhost, so the herdr plugin local.link-toast opens this URL's path.
export function openFileUrl(path: string): string {
  return `http://localhost/open-file${path.split('/').map(encodeURIComponent).join('/')}`
}

export function shots(tool: string, input: unknown): { caption: string; files: string[] } | null {
  const fields = (input ?? {}) as Fields
  const files =
    tool === 'SendUserFile' ? (fields.files ?? []).filter(file => IMAGE_FILE.test(file))
    : tool === 'Read' && fields.file_path !== undefined && IMAGE_FILE.test(fields.file_path) ? [fields.file_path]
    : []
  if (files.length === 0) {
    return null
  }
  return { caption: fields.caption ?? files.map(file => file.split('/').pop()).join(' · '), files }
}

function firstText(input: unknown): string | undefined {
  const value = Object.values((input ?? {}) as Record<string, unknown>).find(v => typeof v === 'string')
  return typeof value === 'string' ? value.split('\n')[0] : undefined
}

export function summary(tool: string, input: unknown, home: string): string | null {
  if (ENGINE_DRAWN.has(tool)) {
    return null
  }
  const fields = (input ?? {}) as Fields
  const path = fields.file_path === undefined ? undefined : shortPath(fields.file_path, home)
  switch (tool) {
    case 'Bash':
      return fields.description ?? fields.command?.split('\n')[0] ?? ''
    case 'Read': {
      const { offset, limit } = fields
      const range = offset === undefined ? '' : `:${offset}-${limit === undefined ? '' : offset + limit}`
      return `Read ${path}${range}`
    }
    case 'Edit':
      return PLAN_FILE.test(fields.file_path ?? '') ? `Updated plan ${path?.split('/').pop()}` : `Edit ${path}`
    case 'Write':
      return PLAN_FILE.test(fields.file_path ?? '') ? `Wrote plan ${path?.split('/').pop()}` : `Write ${path}`
    case 'WebFetch':
      return `Fetch ${(fields.url ?? '').replace(/^https?:\/\//, '')}`
    case 'WebSearch':
      return `Search "${fields.query ?? ''}"`
    case 'Agent':
      return `Agent: ${fields.description ?? ''}`
    case 'Skill':
      return `Skill ${fields.skill ?? ''}`
    case 'SendUserFile':
      return `Sent ${(fields.files ?? []).map(file => file.split('/').pop()).join(', ')}`
  }
  const mcp = /^mcp__(.+?)__(.+)$/.exec(tool)
  const name = mcp ? `${(mcp[1] ?? '').replace(/^claude_ai_/, '')} ${mcp[2] ?? ''}` : tool
  const detail = firstText(input)
  return detail === undefined ? name : `${name}: ${detail}`
}

type Hunk = { lines?: string[] }

export function diffStat(output: unknown): string {
  const hunks = ((output ?? {}) as { structuredPatch?: Hunk[] }).structuredPatch ?? []
  const lines = hunks.flatMap(hunk => hunk.lines ?? [])
  const added = lines.filter(line => line.startsWith('+')).length
  const removed = lines.filter(line => line.startsWith('-')).length
  return added + removed === 0 ? '' : `+${added} −${removed}`
}

const SLOW_MS = 10_000

export function elapsed(ms: number | undefined): string {
  if (ms === undefined || ms < SLOW_MS) {
    return ''
  }
  const seconds = Math.round(ms / 1000)
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`
}

export function failure(output: unknown): string {
  const exit = typeof output === 'string' ? /^Exit code (\d+)/.exec(output) : null
  return exit ? `exit ${exit[1]}` : 'failed'
}

const PIPELINE_WAIT = /\(gitlab\/wait_for_pipeline\) failed/

// A wait slice caps at 600 s and Claude re-arms it, so its timeout row is noise.
export function isPipelineWaitTimeout(text: string, status: string | undefined): boolean {
  return status === 'failed' && PIPELINE_WAIT.test(text)
}

export type Box = { columns: number; rows: number }
export type ThumbSize = 'small' | 'large'

export const THUMB_BOXES: Record<ThumbSize, Box> = {
  small: { columns: 40, rows: 10 },
  large: { columns: 120, rows: 40 },
}

// The terminal draws nothing for a PNG wider or taller than this, so bigger ones are drawn from a shrunk copy.
export const MAX_IMAGE_SIDE = 2048

export function isOversized(info: ShotInfo): boolean {
  return info.width > MAX_IMAGE_SIDE || info.height > MAX_IMAGE_SIDE
}

// A path starts at the start of a word, so the `//host/a.png` of a URL is not one.
const PNG_PATHS = /(?<![^\s"'`()<>[\]{},;=])[^\s"'`()<>[\]{},;:\\]+\.png\b/gi
const LEADING_CD = /^\s*cd\s+(\S+)\s*&&/

function resolve(dir: string, home: string, target: string): string {
  const raw = target.replace(/^(['"])(.*)\1$/, '$2')
  const path = raw === '~' || raw.startsWith('~/') ? home + raw.slice(1) : raw.startsWith('/') ? raw : `${dir}/${raw}`
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (part === '..') {
      parts.pop()
    } else if (part !== '' && part !== '.') {
      parts.push(part)
    }
  }
  return `/${parts.join('/')}`
}

// Where a command's relative paths point: the session cwd, moved by any `cd X &&` it starts with.
export function commandDir(command: string, cwd: string, home: string): string {
  let dir = cwd
  let rest = command
  for (let cd = LEADING_CD.exec(rest); cd !== null; cd = LEADING_CD.exec(rest)) {
    dir = resolve(dir, home, cd[1] ?? '~')
    rest = rest.slice(cd[0].length)
  }
  return dir
}

// Terminal cells are about twice as tall as wide, so a picture keeps its shape at half the rows.
export function fit(info: { width: number; height: number }, box: Box): Box {
  let columns = box.columns
  let rows = Math.round((columns * info.height) / info.width / 2)
  if (rows > box.rows) {
    rows = box.rows
    columns = Math.round((rows * 2 * info.width) / info.height)
  }
  const clamp = (n: number) => Math.min(255, Math.max(1, n))
  return { columns: clamp(columns), rows: clamp(rows) }
}

// `text` is JSON, so its escapes (`\n`, `\"`, `\/`) are undone before paths are cut out of it.
export function pngPathsIn(text: string, dir: string, home: string): string[] {
  const paths = text.replace(/\\\//g, '/').replace(/\\[nrt"\\]/g, ' ').match(PNG_PATHS) ?? []
  return [...new Set(paths.map(path => resolve(dir, home, path)))]
}

export function thumbArgs(args: string, home: string): { file: string; size: ThumbSize } | { pasted: true } {
  const trimmed = args.trim()
  const file = trimmed.replace(/^big\s+/, '')
  if (/^\[Image #\d+\]$/.test(file)) {
    return { pasted: true }
  }
  return { file: file.replace(/^~(?=\/|$)/, home), size: file === trimmed ? 'small' : 'large' }
}

// The newest call showing an unchanged image keeps it, so a Read checked before SendUserFile does not draw it twice.
export function supersede(all: Thumbs, id: string, found: readonly Thumb[]): Thumbs {
  const isShown = (thumb: Thumb) => found.some(f => f.file === thumb.file && f.mtimeMs === thumb.mtimeMs)
  const rest = Object.fromEntries(Object.entries(all).map(([key, list]) => [key, key.startsWith('cmd:') ? list : list.filter(thumb => !isShown(thumb))]))
  return { ...rest, [id]: [...found] }
}
