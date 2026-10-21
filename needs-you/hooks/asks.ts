export const MARKER = '⏸ Needs you:'

export type Segment = { kind: 'markdown' | 'ask'; text: string }

const ASK_LINE = /^\s*(?:[-*]\s+)?⏸\s*Needs you:\s*(.*)$/
const FENCE = /^\s*(```|~~~)/

export function segments(text: string): Segment[] {
  const out: Segment[] = []
  let markdown: string[] = []
  let isInFence = false
  const flush = () => {
    if (markdown.join('').trim() !== '') {
      out.push({ kind: 'markdown', text: markdown.join('\n') })
    }
    markdown = []
  }
  for (const line of text.split('\n')) {
    if (FENCE.test(line)) {
      isInFence = !isInFence
    }
    const ask = isInFence ? null : ASK_LINE.exec(line)
    if (ask) {
      flush()
      out.push({ kind: 'ask', text: (ask[1] ?? '').trim() })
    } else {
      markdown.push(line)
    }
  }
  flush()
  return out
}

export function asksIn(text: string): string[] {
  return segments(text).filter(s => s.kind === 'ask').map(s => s.text)
}

export const INSTRUCTION = `# Asks that block on the user

The user skims long replies, so an ask buried in prose gets missed.

- A yes/no approval or a choice between options (an outward write such as a push, an issue, an MR comment; a destructive step) is asked with the AskUserQuestion tool, never as a sentence in the reply.
- Anything else the reply waits on the user for (look at something, test visually, run a command in their terminal, supply a value) goes on its own line starting with \`${MARKER}\`, one line per ask, plain text without links or code spans.
- Never use the marker for anything that does not block on the user.`
