import type { MrCard, MrKind } from '../types'

// Threads and thread replies get no card: a review posts one per finding, mr-threads replies by the dozen.
const GITLAB_KINDS: Record<string, MrKind> = {
  mcp__gitlab__create_merge_request: 'created',
  mcp__gitlab__merge_merge_request: 'merged',
  mcp__gitlab__approve_merge_request: 'approved',
  mcp__gitlab__create_merge_request_note: 'reviewed',
  mcp__gitlab__publish_draft_note: 'reviewed',
  mcp__gitlab__bulk_publish_draft_notes: 'reviewed',
}

const CLI = /\b(?:glab\s+mr|gh\s+pr)\s+(create|merge|approve|review|note|comment)\b/
const MR_URL = /https?:\/\/[^\s"'<>\\)]+?\/(?:-\/merge_requests|pull)\/\d+/
// `gh pr merge` and `gh pr review` name the PR only as `owner/repo#12`.
const GH_REF = /\b([\w.-]+\/[\w.-]+)#(\d+)\b/

export function kindOf(tool: string, input: Record<string, unknown>): MrKind | null {
  if (tool !== 'Bash') {
    return GITLAB_KINDS[tool] ?? null
  }
  const verb = CLI.exec(String(input.command ?? ''))?.[1]
  if (verb === undefined) {
    return null
  }
  if (verb === 'review') {
    return /\s(--approve|-a)\b/.test(String(input.command)) ? 'approved' : 'reviewed'
  }
  return verb === 'create' ? 'created' : verb === 'merge' ? 'merged' : verb === 'approve' ? 'approved' : 'reviewed'
}

export function urlIn(text: string): string | undefined {
  const github = GH_REF.exec(text)
  return MR_URL.exec(text)?.[0] ?? (github ? `https://github.com/${github[1]}/pull/${github[2]}` : undefined)
}

export function refOf(url: string | undefined, iid: unknown): string {
  const gitlab = url && /\/-\/merge_requests\/(\d+)$/.exec(url)?.[1]
  const github = url && /\/pull\/(\d+)$/.exec(url)?.[1]
  return gitlab ? `!${gitlab}` : github ? `#${github}` : iid ? `!${iid}` : ''
}

// A GitLab MR object as the MCP server answers it; null for anything else (a note, an approval).
export function mergeRequestIn(text: string): { url: string; title?: string } | null {
  try {
    const mr = JSON.parse(text) as { iid?: unknown; web_url?: unknown; title?: unknown }
    const url = typeof mr.web_url === 'string' ? urlIn(mr.web_url) : undefined
    return mr.iid !== undefined && url ? { url, title: typeof mr.title === 'string' ? mr.title : undefined } : null
  } catch {
    return null
  }
}

export function cardFrom(kind: MrKind, text: string, iid?: unknown): MrCard {
  const mr = mergeRequestIn(text)
  const url = mr?.url ?? urlIn(text)
  return { kind, ref: refOf(url, iid), url, title: mr?.title }
}

export function label(card: MrCard): string {
  const noun = card.ref.startsWith('#') ? 'PR' : 'MR'
  return `${noun} ${card.kind}`.toUpperCase()
}
