export type Vault = Record<string, { value: string; rule: string }>

declare module 'claude-code' {
  interface PluginState {
    redact: { vault: Vault }
  }
}
