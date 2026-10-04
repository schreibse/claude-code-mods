export type Handover = { text: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    handover: { pending: string | null }
  }
}
