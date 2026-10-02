export type MrKind = 'created' | 'merged' | 'approved' | 'reviewed'
export type MrCard = { kind: MrKind; ref: string; url?: string; title?: string }
export type Cards = Record<string, MrCard>

declare module 'claude-code' {
  interface PluginState {
    'mr-banner': { cards: Cards }
  }
}
