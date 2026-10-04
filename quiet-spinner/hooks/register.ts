import type { Register } from 'claude-code'
import { word } from './words'

export const register: Register = on => {
  on('ui.render', { component: 'Spinner' }, ($, e, next) =>
    next({ ...e, props: { ...e.props, word: word(e.props.mode) } }),
  )

  on('ui.render', { component: 'TurnDuration' }, ($, e, next) =>
    next({ ...e, props: { ...e.props, word: 'Took' } }),
  )
}
