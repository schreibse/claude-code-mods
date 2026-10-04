import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { handoverPath, isFresh, sentenceOf, storeKey } from './rules'
import type { Handover } from '../types'

const COPY_COMMAND = 'handover-copy'
const OFFER_EVERY_MS = 500
const OFFER_TRIES = 20

const pending = atom({ plugin: 'handover', key: 'pending' } as const, null)

export const register: Register = on => {
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const result = await next(e)
    const home = (await $.env.get('HOME')) ?? ''
    if (result.isError || home === '' || e.file_path !== handoverPath(home)) {
      return result
    }
    const text = sentenceOf(e.content)
    const handover: Handover = { text, at: await $.clock.now() }
    await $.store.set(storeKey(await $.session.root()), handover)
    await update($, pending, () => text)
    return result
  })

  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    if (e.source !== 'clear' && e.source !== 'startup') {
      return result
    }
    const key = storeKey(await $.session.root())
    const stored = (await $.store.get(key)) as Handover | undefined
    if (!isFresh(stored, await $.clock.now())) {
      return result
    }
    await update($, pending, () => null)
    // At SessionStart the /clear itself still counts as a running turn, so the box refuses the suggestion.
    let tries = 0
    const offer = $.clock.every(OFFER_EVERY_MS, async () => {
      if (++tries > OFFER_TRIES) {
        offer.cancel()
        return
      }
      if ((await $.prompt.suggest({ text: stored.text })).isShown) {
        offer.cancel()
        await $.store.delete(key)
      }
    })
    return result
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COPY_COMMAND, description: 'Copy the handover sentence and hide its band' })
    return next(e)
  })

  // A band's buttons take a press only once it holds focus, so copying is a command typed at the prompt.
  on('command.run', { command: COPY_COMMAND }, async $ => {
    const text = await read($, pending) ?? ((await $.store.get(storeKey(await $.session.root()))) as Handover | undefined)?.text
    if (!text) {
      return { text: 'No handover sentence yet.' }
    }
    const copied = await $.ui.copy({ text })
    if (!copied.isCopied) {
      return { text: `Not copied: ${copied.reason}` }
    }
    await update($, pending, () => null)
    return { text: 'Handover copied.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const text = await read($, pending)
    const band = await next(e)
    if (text === null || e.props.hasSurvey) {
      return band
    }
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {band}
        <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="cyan">
          <Box>
            <Text color="cyan" bold>handover </Text>
            <Text dimColor>/{COPY_COMMAND} to copy · /clear, then Tab</Text>
          </Box>
          <Text>{text}</Text>
        </Box>
      </Box>
    )
  })
}
