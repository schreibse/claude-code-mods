export type Repo = { name: string; branch: string; worktree: string | null; color: string }

declare module 'claude-code' {
  interface PluginState {
    'repo-line': { repo: Repo | null }
  }
}
