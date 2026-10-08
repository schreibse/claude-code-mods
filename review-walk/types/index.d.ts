export type Decision = 'fix' | 'issue' | 'skip' | 'other'
export type Finding = { where: string; category: string | null; label: string }
export type Walk = { findings: Finding[]; asking: number | null; decisions: (Decision | null)[] }

declare module 'claude-code' {
  interface PluginState {
    'review-walk': { walk: Walk | null }
  }
}
