export type UsageLine = string | null
export type NxLine = string | null

declare module 'claude-code' {
  interface PluginState {
    'usage-percent': { line: UsageLine; nx: NxLine }
  }
}
