import type { Register } from 'claude-code'

import { proseAsk, reason } from './guard'

export const register: Register = on => {
  on('classic.Stop', async ($, e, next) => {
    const result = await next(e)
    if (e.stop_hook_active || result.block !== undefined) {
      return result
    }
    const line = proseAsk(e.last_assistant_message ?? '')
    return line === null ? result : { ...result, block: reason(line) }
  })
}
