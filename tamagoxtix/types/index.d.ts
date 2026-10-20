export type TamaStatusPiece = { text: string; tone: 'dim' | 'yellow' | 'red' | 'green' }

export type TamaPalette = {
  id: string
  label: string
  mode: string
  bg: string
  fg: string
  muted: string
  accent: string
  red: string
  orange: string
  yellow: string
  green: string
  cyan: string
  blue: string
  magenta: string
}

export type TamaMonster = {
  seed: number
  name: string
  body: string
  legs: string
  color: string
  accent: string
  face: { left: string; right: string; eye: string; mouth: string }
  /** The sidebar icon's name (icons.mjs). */
  icon: string
}

/** The turn the spinner is drawing: when it started and the output so far. */
export type TamaTurn = { startedAt: number }

export type TamaUsageDay = { date: string; tokens: number; output: number }
export type TamaUsage = {
  generatedAt: number
  days: TamaUsageDay[]
  today: { date: string; tokens: number; output: number; hours: { hour: number; tokens: number }[] }
  session: { start: number; end: number; tokens: number } | null
  week: { start: number; tokens: number }
}
export type TamaLimit = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    /** usage-percent's memory line, drawn on the band's third line when that mod runs. */
    'usage-percent': { memory: TamaStatusPiece[] | null }
    tamagoxtix: {
      palette: TamaPalette | null
      monster: TamaMonster | null
      turn: TamaTurn | null
      usage: TamaUsage | null
      limits: TamaLimit[]
      /** When Claude last went quiet; the idle band counts from it. */
      idleSince: number
      /** Whether the idle band shows (/tamagoxtix pet on|off). */
      showPet: boolean
      /** True when `node` could not be started: the usage numbers need it. */
      nodeMissing: boolean
      /** A prompt is being typed: the band cheers instead of idling. */
      drafting: boolean
      /** The agent session herdr recorded for the pane: the monster's seed. */
      herdrSeed: { pane: string; key: string } | null
    }
  }
}
