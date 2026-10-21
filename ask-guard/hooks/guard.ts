const FENCE = /^\s*(```|~~~)/
const QUOTED = /`[^`]*`|"[^"\n]*"|“[^”\n]*”|'[^'\n]*\?'/g
const ASK = /\b(shall i|should i|want me to|do you want me|would you like me|ok to|okay to|may i|go ahead and|proceed with|push (it|this|now)|commit (it|this|now))\b[^?\n]*\?/i

export function proseAsk(text: string): string | null {
  let isInFence = false
  for (const line of text.split('\n')) {
    if (FENCE.test(line)) {
      isInFence = !isInFence
      continue
    }
    if (isInFence || /^\s*>/.test(line) || line.includes('Needs you:')) {
      continue
    }
    const match = ASK.exec(line.replace(QUOTED, ''))
    if (match) {
      return line.trim()
    }
  }
  return null
}

export function reason(line: string): string {
  return `ask-guard: your reply asks the user in prose: "${line}". Re-ask it with the AskUserQuestion tool (options, recommended first) and do nothing else; if it does not block on the user, say "no ask" and stop.`
}
