// Surface module drawn in place of Claude Code's spinner line: the agent's
// monster acting out the turn's mode, a clock that fills as time passes and
// a money bar that fills with the tokens and earns a $ every 10k.
//
// Runs on the drawing thread with its own frame clock, so the animation does
// not cost the hooks module a redraw per frame.
import type { ClientElements, ClientModule, ClientSurface } from 'claude-code'

import { scene, workSceneAt } from './lib/scenes.mjs'
import { slotColor } from './lib/monsters.mjs'
import type { TamaMonster, TamaPalette } from './types'

type Run = { text: string; fg?: string; bg?: string }
type SceneData = { rows: Run[][]; fx: string[]; fxSlot: string; caption: string }

// Draws a scene (scenes.mjs) as Text rows (monospaced, so the desktop app lines
// them up as a terminal does): the pixels as half blocks in the monster's
// palette colors, then the effects column.
function sceneRows(Text: ClientElements['Text'], monster: TamaMonster, palette: TamaPalette, data: SceneData) {
  const color = (slot?: string) => (slot ? slotColor(monster, slot, palette) : undefined)
  return data.rows.map((runs, i) => (
    <Text mono>
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
  tokens: number
  /** false: one still frame per scene; the clock and the bars still tick once a second. */
  animate: boolean
}

type State = { frame: number }

const FRAME_MS = 160
const STILL_MS = 1000
const STILL_FRAME = 7 // the frame where most scenes show their effect
const BAR_CELLS = 8
const TOKENS_PER_BAR = 10_000 // the token bar fills once per 10k tokens, then earns a $
const MAX_MARKS = 10
const GAP = 2 // columns between the monster and the text

const MODE_LABEL: Record<string, string> = {
  requesting: 'is calling',
  thinking: 'is thinking',
  'tool-input': 'is writing a tool call',
  'tool-use': 'is using tools',
  responding: 'is writing',
}

function formatCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`
  return String(Math.round(n))
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

  // both bars fill in eight steps: one minute of time, 10k tokens
  const seconds = Math.floor(elapsed / 1000)
  const time = cycleBar(seconds, 60)
  const money = cycleBar(props.tokens, TOKENS_PER_BAR)
  const timeLabel = formatElapsed(elapsed)
  const moneyLabel = formatCount(props.tokens)
  const width = Math.max(timeLabel.length, moneyLabel.length)

  const dots = '.'.repeat((Math.floor(frame / 3) % 3) + 1).padEnd(3)
  const label = acting.caption || (MODE_LABEL[mode] ?? mode)

  return (
    <Box flexDirection="row" gap={GAP} marginTop={1}>
      <Box flexDirection="column">{sprite}</Box>
      <Box flexDirection="column">
        <Text mono>
          <Text mono color={palette.accent} bold>
            {props.word}
          </Text>
          <Text mono color={palette.accent}>{dots}</Text>
          <Text mono color={palette.muted}> {monster.name} {label}</Text>
        </Text>
        <Text mono>
          <Text mono color={palette.cyan}>{CLOCK[seconds % 4]} </Text>
          <Text mono color={palette.fg} bold>
            {timeLabel.padEnd(width)}
          </Text>
          <Text mono> </Text>
          <Text mono color={palette.cyan}>{time.bar}</Text>
          <Text mono color={palette.cyan}> {marks('●', time.laps)}</Text>
        </Text>
        <Text mono>
          <Text mono color={palette.yellow} bold>
            {'$ '}
            {moneyLabel.padEnd(width)}
          </Text>
          <Text mono> </Text>
          <Text mono color={palette.yellow}>{money.bar}</Text>
          <Text mono color={palette.yellow} bold>
            {' '}
            {marks('$', money.laps)}
          </Text>
          <Text mono color={palette.muted}>{money.laps > 0 ? ' · ' : ''}tokens · esc to interrupt</Text>
        </Text>
      </Box>
    </Box>
  )
}

export default Spinner
