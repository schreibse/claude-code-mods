// Surface module for the band above the prompt while Claude waits for you:
// the monster naps, snacks, sips coffee, plays, reads or goes to the
// bathroom, a new scene every 40 seconds; while you type a prompt it cheers
// you on instead, a new cheer every 10 seconds.
import type { ClientElements, ClientModule, ClientSurface } from 'claude-code'

import { cheerSceneAt, gitlabFox, idleSceneAt, octocat, scene } from './lib/scenes.mjs'
import { slotColor } from './lib/monsters.mjs'
import type { TamaGithub, TamaMonster, TamaPalette } from './types'

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

export type IdleProps = {
  monster: TamaMonster
  palette: TamaPalette
  idleSince: number
  todayCount: number | null
  /** The project's GitHub repository, or null when it is not on GitHub. */
  github: TamaGithub | null
  /** The band's width: columns that do not fit are left out. */
  columns: number
  /** "nerd" draws Nerd Font icons, anything else plain symbols. */
  icons: string
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
}

// GitHub glyphs: octicons from a Nerd Font, or plain symbols without one.
const GLYPHS = {
  nerd: { branch: '\u{f418}', issue: '\u{f41b}', pr: '\u{f407}', tag: '\u{f412}', star: '\u{f41e}', ok: '\u{f49e}', fail: '\u{f52f}', pending: '\u{f444}' },
  plain: { branch: '⎇', issue: '◎', pr: '⇄', tag: '⌁', star: '★', ok: '✓', fail: '✗', pending: '●' },
}

// Widths of the band's parts, to decide what fits.
const WIDTH = { scene: 33, caption: 46, github: 46 }

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
  if (props.compact) {
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

  const separator = () => (
    <Box flexDirection="column">{['│', '│', '│'].map(line => <Text mono color={palette.muted}>{line}</Text>)}</Box>
  )
  const showGithub = props.github !== null && props.columns >= WIDTH.scene + WIDTH.caption + WIDTH.github

  // the repository: an octocat for GitHub or a fox for GitLab, then name and
  // stars, branch and its state,
  // version, open issues and pull requests, and the last CI run
  const g = props.github
  const icon = props.icons === 'nerd' ? GLYPHS.nerd : GLYPHS.plain
  const githubColumn = g && (
    <Box flexDirection="row" gap={2}>
      <Box flexDirection="column">
        {(g.forge === 'gitlab' ? gitlabFox(frame) : octocat(frame, 'fg')).map(runs => (
          <Text mono>
            {runs.map(run => (
              <Text
                color={run.fg ? (palette as Record<string, string>)[run.fg] ?? palette.fg : undefined}
                backgroundColor={run.bg ? (palette as Record<string, string>)[run.bg] ?? palette.fg : undefined}
              >
                {run.text}
              </Text>
            ))}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column">
        <Text mono>
          <Text mono color={palette.fg} bold>
            {g.repo}
          </Text>
          {g.stars !== null && <Text mono color={palette.yellow}>{`  ${icon.star} ${g.stars}`}</Text>}
          {g.ci && (
            <Text mono color={g.ci === 'success' ? palette.green : g.ci === 'failure' ? palette.red : palette.yellow}>
              {`  ${g.ci === 'success' ? icon.ok : g.ci === 'failure' ? icon.fail : icon.pending} ci`}
            </Text>
          )}
        </Text>
        <Text mono>
          <Text mono color={palette.magenta}>{`${icon.branch} ${g.branch}`}</Text>
          {g.ahead > 0 && <Text mono color={palette.green}>{` ↑${g.ahead}`}</Text>}
          {g.behind > 0 && <Text mono color={palette.orange}>{` ↓${g.behind}`}</Text>}
          {g.dirty > 0 && <Text mono color={palette.yellow}>{` ●${g.dirty}`}</Text>}
        </Text>
        <Text mono>
          {g.version && <Text mono color={palette.cyan}>{`${icon.tag} ${g.version}  `}</Text>}
          {g.issues !== null && <Text mono color={palette.green}>{`${icon.issue} ${g.issues}  `}</Text>}
          {g.prs !== null && <Text mono color={palette.blue}>{`${icon.pr} ${g.prs}`}</Text>}
        </Text>
      </Box>
    </Box>
  )

  return (
    <Box flexDirection="row" gap={2} marginTop={1}>
      <Box flexDirection="column">{sceneRows(Text, monster, palette, data)}</Box>
      <Box flexDirection="column">
        <Text mono>
          <Text mono color={palette.accent} bold>
            {monster.name}
          </Text>
          <Text mono color={palette.fg}> {data.caption}</Text>
        </Text>
        {props.cheering ? (
          <Text mono color={palette.orange}>{CHEERS[Math.floor(now / 10_000) % CHEERS.length]} · enter to send</Text>
        ) : (
          <Text mono color={palette.muted}>waiting for you · idle {formatIdle(now - props.idleSince)}</Text>
        )}
        {props.nodeMissing ? (
          <Text mono color={palette.orange}>install Node.js 18+ to see your usage · /tamagoxtix doctor</Text>
        ) : (
        <Text mono>
          {props.todayCount !== null && (
            <Text mono>
              <Text mono color={palette.yellow}>$ {formatCount(props.todayCount)}</Text>
              <Text mono color={palette.muted}> tokens today · </Text>
            </Text>
          )}
          <Text mono color={palette.muted}>/tamagoxtix for stats</Text>
        </Text>
        )}
      </Box>
      {showGithub && separator()}
      {showGithub && githubColumn}
    </Box>
  )
}

export default Idle
