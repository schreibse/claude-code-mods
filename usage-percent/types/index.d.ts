export type Tone = 'dim' | 'yellow' | 'red' | 'green'
export type Piece = { text: string; tone: Tone }
export type UsageLine = Piece[] | null
export type NxLine = { middle: Piece[]; right: Piece[] } | null

declare module 'claude-code' {
  interface PluginState {
    'usage-percent': { line: UsageLine; nx: NxLine }
  }
}
