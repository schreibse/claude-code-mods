export type IsLoud = boolean
export type Thumb = { file: string; size: 'small' | 'large'; info: { width: number; height: number; bytes: number }; mtimeMs: number }
export type Thumbs = Record<string, Thumb[]>

declare module 'claude-code' {
  interface PluginState {
    'quiet-bash': { isLoud: IsLoud; thumbs: Thumbs }
  }
}
