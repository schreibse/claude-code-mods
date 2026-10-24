import type { Register } from 'claude-code'

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0)$/i
const URL_HOST = /\b[a-z][a-z0-9+.-]*:\/\/(?:[^\s/@'"]*@)?([^\s/:'"?#]+)/gi
// A Bash command with none of these is assumed not to talk to the network.
const NETWORK = /\b(curl|wget|http|https|urllib|requests|fetch|axios|ssh|scp|rsync|nc|ncat|telnet|ftp|sendmail|mail|gh|glab|git\s+push)\b/i

const hostsIn = (text: string) => [...text.matchAll(URL_HOST)].map(m => m[1] ?? '')

const isLocalOnly = (text: string) => {
  const hosts = hostsIn(text)
  return hosts.length > 0 && hosts.every(h => LOCAL_HOST.test(h))
}

export const register: Register = (on, options) => {
  const identifiers = String(options.identifiers ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)

  on('classic.PreToolUse', ($, e, next) => {
    if (identifiers.length === 0) return next(e)

    const { tool, tool_use_id, ...input } = e
    const text = JSON.stringify(input)
    const lower = text.toLowerCase()
    const found = identifiers.filter(
      id => lower.includes(id) || lower.includes(encodeURIComponent(id).toLowerCase()),
    )
    if (found.length === 0) return next(e)

    const outbound =
      tool === 'WebFetch' || tool === 'WebSearch' || tool.startsWith('mcp__')
        ? !isLocalOnly(text)
        : tool === 'Bash'
          ? NETWORK.test(text) && !isLocalOnly(text)
          : false
    if (!outbound) return next(e)

    const masked = found.map(id => `${id.slice(0, 3)}…`).join(', ')
    return {
      ask: `${$.plugin.name}: this ${tool} call contains personal data (${masked}) and may send it off this machine. Allow only if you asked for exactly this.`,
    }
  }).catch(($, e, next) =>
    next.called ? next(e) : { ask: `${$.plugin.name}: its check failed, so it asks instead.` },
  )
}
