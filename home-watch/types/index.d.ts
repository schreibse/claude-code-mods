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
  reason?: string
  approver?: 'host' | 'person'
  dialog?: boolean
  refused?: boolean
  didRun?: boolean
  didEnd?: boolean
}
export type Outcome = 'blocked' | 'allowed' | 'waiting' | 'approved' | 'declined'
export type Watched = { sighting: Sighting; verdict: Verdict; tag: Tag | null }

declare module 'claude-code' {
  interface PluginState {
    'home-watch': {
      calls: Record<string, Watched>
      pending: PendingCall[]
      /** The id of the call the band names as the last one. */
      last: string | null
      problem: string | null
    }
  }
}
