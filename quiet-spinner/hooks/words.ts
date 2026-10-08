const WORDS: Record<string, string> = {
  requesting: 'waiting',
  responding: 'writing',
  thinking: 'thinking',
  'tool-input': 'preparing',
  'tool-use': 'running',
}

// A mode the engine adds later keeps its own name rather than a blank spinner.
export function word(mode: string): string {
  return WORDS[mode] ?? mode
}
