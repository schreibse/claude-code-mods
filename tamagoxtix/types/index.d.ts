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
/** The project's repository, when it lives on GitHub or GitLab. */
export type TamaGithub = {
  forge: 'github' | 'gitlab'
  repo: string
  branch: string
  dirty: number
  ahead: number
  behind: number
  version: string | null
  issues: number | null
  prs: number | null
  stars: number | null
  ci: 'success' | 'failure' | 'pending' | null
  /** When the GitHub API part was last fetched. */
  fetchedAt: number
}
export type TamaLimit = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
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
      github: TamaGithub | null
      /** True when `node` could not be started: the usage numbers need it. */
      nodeMissing: boolean
      /** A prompt is being typed: the band cheers instead of idling. */
      drafting: boolean
      /** The folder last found without a repository, and when. */
      noRepo: { cwd: string; at: number } | null
      /** The agent session herdr recorded for the pane: the monster's seed. */
      herdrSeed: { pane: string; key: string } | null
    }
  }
}
