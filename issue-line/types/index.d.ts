export type Issue = { iid: number; title: string; state: string; url: string }
export type MergeRequest = { iid: number; state: string; draft: boolean; url: string; threads: number; openThreads: number; pipeline: string | null }
export type IssueLine = { issue: Issue | null; mr: MergeRequest | null; openMrs: number; isPinned: boolean }
export type Focus = { kind: 'issue' | 'mr'; iid: number; source: 'pin' | 'prompt' }

declare module 'claude-code' {
  interface PluginState {
    'issue-line': { line: IssueLine | null; focus: Focus | null; workdir: string | null }
  }
}
