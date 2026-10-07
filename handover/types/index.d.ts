export type Handover = { text: string; at: number; root: string }

declare module 'claude-code' {
  interface PluginState {
    handover: { pending: string | null; choices: string[] | null }
  }
}
