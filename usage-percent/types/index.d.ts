export type Tone = 'dim' | 'yellow' | 'red' | 'green'
export type Piece = { text: string; tone: Tone }
export type UsageLine = Piece[] | null
export type NxLine = Piece[] | null
export type MemoryLine = Piece[] | null

declare module 'claude-code' {
  interface PluginState {
    'usage-percent': { line: UsageLine; nx: NxLine; memory: MemoryLine }
  }
}
