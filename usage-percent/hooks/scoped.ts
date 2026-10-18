// A weekly window the usage endpoint scopes to one model, which the API's rate-limit headers never carry.
export type ScopedWindow = { label: string; percentUsed: number; resetsAt?: string }

export const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage?skip_spend=1'

type Limit = { kind?: string; percent?: number; resets_at?: string; scope?: { model?: { display_name?: string } | null } | null }

export function scopedWindows(text: string): ScopedWindow[] {
  let limits: unknown
  try {
    limits = (JSON.parse(text) as { limits?: unknown }).limits
  } catch {
    return []
  }
  if (!Array.isArray(limits)) {
    return []
  }
  return (limits as Limit[]).flatMap(limit => {
    const model = limit.scope?.model?.display_name
    if (limit.kind !== 'weekly_scoped' || typeof model !== 'string' || typeof limit.percent !== 'number') {
      return []
    }
    return [{ label: model.toLowerCase(), percentUsed: limit.percent, resetsAt: limit.resets_at }]
  })
}
