export type Severity = 'critical' | 'major' | 'minor' | 'trivial' | 'other'
export type Tally = { ref: string; url: string; open: Record<Severity, number>; nitpicks: number }

declare module 'claude-code' {
  interface PluginState {
    'coderabbit-band': { tally: Tally | null; hiddenAt: string | null }
  }
}
