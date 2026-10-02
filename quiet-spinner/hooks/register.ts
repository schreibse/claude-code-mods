import type { Register } from 'claude-code'

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

export const register: Register = on => {
  on('ui.render', { component: 'Spinner' }, ($, e, next) =>
    next({ ...e, props: { ...e.props, word: word(e.props.mode) } }),
  )

  on('ui.render', { component: 'TurnDuration' }, ($, e, next) =>
    next({ ...e, props: { ...e.props, word: 'Took' } }),
  )
}
