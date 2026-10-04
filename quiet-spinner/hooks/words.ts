const WORDS = {
  requesting: 'waiting',
  responding: 'writing',
  thinking: 'thinking',
  'tool-input': 'preparing',
  'tool-use': 'running',
} as const

export function word(mode: keyof typeof WORDS): string {
  return WORDS[mode]
}
