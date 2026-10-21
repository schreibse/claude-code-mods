export type NeedsYouAsks = readonly string[]

declare module 'claude-code' {
  interface PluginState {
    'needs-you': { asks: NeedsYouAsks }
  }
}
