export type Decision = 'allow' | 'ask' | 'deny'
export type Tag = 'blocked' | 'asked' | 'allowed'
export type Place = { home: string; root: string; cwd: string; problem: string | null }
export type Sighting = { tool: string; paths: string[]; label: string }
export type PendingCall = { id: string; tool: string; input: unknown; agentId?: string }
export type Verdict = {
  decision: Decision
  setting?: string
  rule?: string
  hook?: string
  plugin?: string
  approver?: 'host' | 'person'
  dialog?: boolean
  refused?: boolean
  didRun?: boolean
}
export type Watched = { sighting: Sighting; verdict: Verdict; tag: Tag | null; home: string }
export type Last = { label: string; tag: Tag }

declare module 'claude-code' {
  interface PluginState {
    'home-watch': {
      calls: Record<string, Watched>
      pending: PendingCall[]
      last: Last | null
      problem: string | null
    }
  }
}
