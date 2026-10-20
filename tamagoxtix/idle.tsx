// Surface module for the band above the prompt while Claude waits for you:
// the monster naps, snacks, sips coffee, plays, reads or goes to the
// bathroom, a new scene every 40 seconds; while you type a prompt it cheers
// you on instead, a new cheer every 10 seconds. The hook puts the bands of
// the mods beneath (running tasks, a handover…) under the caption column.
import type { ClientElements, ClientModule, ClientSurface } from 'claude-code'

import { cheerSceneAt, gitlabFox, idleSceneAt, octocat, scene } from './lib/scenes.mjs'
import { slotColor } from './lib/monsters.mjs'
import type { TamaMonster, TamaPalette, TamaStatusPiece } from './types'

type Run = { text: string; fg?: string; bg?: string }
type SceneData = { rows: Run[][]; fx: string[]; fxSlot: string; caption: string }

// Draws a scene (scenes.mjs) as Text rows (monospaced, so the desktop app lines
// them up as a terminal does): the pixels as half blocks in the monster's
// palette colors, then the effects column. A row never wraps: on a narrow
// screen the effects are cut at the edge rather than the pixels split apart.
function sceneRows(Text: ClientElements['Text'], monster: TamaMonster, palette: TamaPalette, data: SceneData) {
  const color = (slot?: string) => (slot ? slotColor(monster, slot, palette) : undefined)
  return data.rows.map((runs, i) => (
    <Text mono wrap="truncate">
      {runs.map(run => (
        <Text mono color={color(run.fg)} backgroundColor={color(run.bg)}>
          {run.text}
        </Text>
      ))}
      <Text mono color={color(data.fxSlot)}>{' ' + (data.fx[i] ?? '')}</Text>
    </Text>
  ))
}

export type IdleProps = {
  monster: TamaMonster
  palette: TamaPalette
  idleSince: number
  todayCount: number | null
  /** The band's width: under MIN_BAND it is one line. */
  columns: number
  /** `node` could not be started, so there are no usage numbers. */
  nodeMissing: boolean
  /** You are typing a prompt: cheer scenes instead of idle ones. */
  cheering?: boolean
  /** Under 3 rows free: one line with the monster's icon instead of the band. */
  compact?: boolean
  /** The monster's icon, a glyph or a symbol (icons.mjs). */
  face?: string
  /** false: one still frame per scene; the scene still changes every 40 seconds. */
  animate?: boolean
  /** The caption column's third line, beside the monster's feet: usage-percent's memory bar. */
  status: TamaStatusPiece[]
}

// Under this many columns the scene and a readable caption do not fit side by
// side, so the band becomes one line.
const MIN_BAND = 44

type State = { frame: number }

const FRAME_MS = 320
const STILL_MS = 10_000 // enough for the idle minutes, the cheer and the scene change
const STILL_FRAME = 7 // the frame where most scenes show their effect

// The line under the caption while you type, a new one every 10 seconds.
const CHEERS = [
  'you got this',
  'great prompt incoming',
  'keep going, it is looking good',
  'Claude is going to love this one',
  'one more line and ship it',
  'this is the prompt',
]

function formatCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`
  return String(Math.round(n))
}

function formatIdle(ms: number): string {
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

const Idle: ClientModule<IdleProps, State> = (props, surface: ClientSurface<State>) => {
  const { Box, Text } = surface.elements
  const animate = props.animate !== false
  if (surface.state === undefined) {
    surface.every(animate ? FRAME_MS : STILL_MS, () => surface.setState({ frame: (surface.state?.frame ?? 0) + 1 }))
  }
  const frame = animate ? surface.state?.frame ?? 0 : STILL_FRAME
  const { monster, palette } = props
  const now = Date.now()
  const data = scene(monster, props.cheering ? cheerSceneAt(monster, now) : idleSceneAt(monster, now), frame)

  // no room for the band: the monster's icon, what it is up to, and today
  if (props.compact || props.columns < MIN_BAND) {
    return (
      <Text mono wrap="truncate-end">
        <Text mono color={palette.accent} bold>{`${props.face ? `${props.face} ` : ''}${monster.name}`}</Text>
        <Text mono color={palette.fg}> {data.caption}</Text>
        {props.cheering ? (
          <Text mono color={palette.orange}>{` · ${CHEERS[Math.floor(now / 10_000) % CHEERS.length]}`}</Text>
        ) : null}
        {props.todayCount !== null && !props.nodeMissing ? (
          <Text mono color={palette.yellow}>{` · $ ${formatCount(props.todayCount)} today`}</Text>
        ) : null}
      </Text>
    )
  }

  // the scene keeps its width; the text beside it is cut at the edge
  return (
    <Box flexDirection="row" gap={2} marginTop={1}>
      <Box flexDirection="column" flexShrink={0}>{sceneRows(Text, monster, palette, data)}</Box>
      <Box flexDirection="column" flexShrink={1}>
        <Text mono wrap="truncate-end">
          <Text mono color={palette.accent} bold>
            {monster.name}
          </Text>
          <Text mono color={palette.fg}> {data.caption}</Text>
        </Text>
        <Text mono wrap="truncate-end">
          {props.cheering ? (
            <Text mono color={palette.orange}>{CHEERS[Math.floor(now / 10_000) % CHEERS.length]} · enter to send</Text>
          ) : (
            <Text mono color={palette.fg}>waiting for you · idle {formatIdle(now - props.idleSince)}</Text>
          )}
          {props.nodeMissing ? (
            <Text mono color={palette.orange}> · install Node.js 18+ to see your usage · /tamagoxtix doctor</Text>
          ) : props.todayCount !== null ? (
            <Text mono color={palette.fg}>{` · ${formatCount(props.todayCount)} today`}</Text>
          ) : null}
        </Text>
        {props.status.length > 0 && (
          <Text mono wrap="truncate-end">
            {props.status.map(piece => (
              <Text mono color={piece.tone === 'dim' ? palette.fg : palette[piece.tone]}>{piece.text}</Text>
            ))}
          </Text>
        )}
      </Box>
    </Box>
  )
}

export default Idle
