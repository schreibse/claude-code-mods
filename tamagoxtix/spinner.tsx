// Surface module drawn in place of Claude Code's spinner line: the agent's
// monster acting out the turn's mode and a clock that fills as time passes.
//
// Runs on the drawing thread with its own frame clock, so the animation does
// not cost the hooks module a redraw per frame.
import type { ClientElements, ClientModule, ClientSurface } from 'claude-code'

import { scene, workSceneAt } from './lib/scenes.mjs'
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

export type SpinnerProps = {
  monster: TamaMonster
  palette: TamaPalette
  mode: string
  word: string
  startedAt: number
  /** false: one still frame per scene; the clock still ticks once a second. */
  animate: boolean
  /** The terminal's width: under MIN_WIDTH the spinner is one line. */
  columns: number
  /** The third line, beside the monster's feet: usage-percent's memory bar. */
  status: TamaStatusPiece[]
}

type State = { frame: number }

const FRAME_MS = 160
const STILL_MS = 1000
const STILL_FRAME = 7 // the frame where most scenes show their effect
const BAR_CELLS = 8
const MAX_MARKS = 10
const GAP = 2 // columns between the monster and the text
const MIN_WIDTH = 44 // narrower than this: one line, no monster

const MODE_LABEL: Record<string, string> = {
  requesting: 'is calling',
  thinking: 'is thinking',
  'tool-input': 'is writing a tool call',
  'tool-use': 'is using tools',
  responding: 'is writing',
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`
}

// A bar of BAR_CELLS that fills over one cycle, and how many cycles are done.
function cycleBar(value: number, perCycle: number): { bar: string; laps: number } {
  const laps = Math.floor(value / perCycle)
  const filled = Math.floor(((value % perCycle) / perCycle) * BAR_CELLS)
  return { bar: '▰'.repeat(filled) + '▱'.repeat(BAR_CELLS - filled), laps }
}

function marks(glyph: string, laps: number): string {
  if (laps <= 0) return ''
  return laps > MAX_MARKS ? `${glyph}×${laps}` : glyph.repeat(laps)
}

const CLOCK = ['◴', '◷', '◶', '◵']

const Spinner: ClientModule<SpinnerProps, State> = (props, surface: ClientSurface<State>) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    surface.every(props.animate ? FRAME_MS : STILL_MS, () => surface.setState({ frame: (surface.state?.frame ?? 0) + 1 }))
  }
  const frame = surface.state?.frame ?? 0
  const { monster, palette, mode } = props
  const elapsed = Date.now() - props.startedAt

  // the monster acts out the mode with its props: laptop, thought bubbles,
  // hammer, keyboard
  const acting = scene(monster, workSceneAt(monster, mode, Date.now()), props.animate ? Math.floor(frame / 2) : STILL_FRAME)
  const sprite = sceneRows(Text, monster, palette, acting)

  // the clock fills in eight steps over one minute, then earns a ● per minute
  const seconds = Math.floor(elapsed / 1000)
  const time = cycleBar(seconds, 60)
  const timeLabel = formatElapsed(elapsed)

  const dots = '.'.repeat((Math.floor(frame / 3) % 3) + 1).padEnd(3)
  const label = acting.caption || (MODE_LABEL[mode] ?? mode)

  // too narrow for the monster: what it is up to and the time
  if (props.columns < MIN_WIDTH) {
    return (
      <Text mono wrap="truncate-end">
        <Text mono color={palette.accent} bold>
          {props.word}
        </Text>
        <Text mono color={palette.accent}>{dots}</Text>
        <Text mono color={palette.cyan}>{` ${CLOCK[seconds % 4]} ${timeLabel}`}</Text>
        <Text mono color={palette.muted}>{` · ${monster.name} ${label}`}</Text>
      </Text>
    )
  }

  // the monster keeps its width; the text beside it is cut at the edge
  return (
    <Box flexDirection="row" gap={GAP} marginTop={1}>
      <Box flexDirection="column" flexShrink={0}>{sprite}</Box>
      <Box flexDirection="column" flexShrink={1}>
        <Text mono wrap="truncate-end">
          <Text mono color={palette.accent} bold>
            {props.word}
          </Text>
          <Text mono color={palette.accent}>{dots}</Text>
          <Text mono color={palette.muted}> {monster.name} {label}</Text>
        </Text>
        <Text mono wrap="truncate-end">
          <Text mono color={palette.cyan}>{CLOCK[seconds % 4]} </Text>
          <Text mono color={palette.fg} bold>
            {timeLabel}
          </Text>
          <Text mono> </Text>
          <Text mono color={palette.cyan}>{time.bar}</Text>
          <Text mono color={palette.cyan}>{time.laps > 0 ? ` ${marks('●', time.laps)}` : ''}</Text>
          <Text mono color={palette.muted}> · esc to interrupt</Text>
        </Text>
        {props.status.length > 0 && (
          <Text mono wrap="truncate-end">
            {props.status.map(piece => (
              <Text mono color={piece.tone === 'dim' ? palette.muted : palette[piece.tone]}>{piece.text}</Text>
            ))}
          </Text>
        )}
      </Box>
    </Box>
  )
}

export default Spinner
