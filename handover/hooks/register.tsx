import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { handoverPath, isFresh, sentenceOf, storeKey } from './rules'
import type { Handover } from '../types'

const COPY_COMMAND = 'handover-copy'
const OFFER_EVERY_MS = 500
const OFFER_TRIES = 20

const pending = atom({ plugin: 'handover', key: 'pending' } as const, null)

// The key of the sentence last offered in the box; the next prompt sent spends it.
let offered: string | null = null

async function offer($: EngineInterface): Promise<void> {
  const key = storeKey(await $.session.root())
  const stored = (await $.store.get(key)) as Handover | undefined
  if (!isFresh(stored, await $.clock.now())) {
    return
  }
  await update($, pending, () => null)
  offered = key
  // The box refuses while the /clear's own turn still runs, and a reset of the box right after
  // can drop a suggestion it had taken, so the same text is proposed again for a while.
  let tries = 0
  const timer = $.clock.every(OFFER_EVERY_MS, async () => {
    if (++tries > OFFER_TRIES || offered !== key) {
      timer.cancel()
      return
    }
    await $.prompt.suggest({ text: stored.text })
  })
}

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

  // A /clear fires no session.start; the box is offered once the command itself is done.
  on('command.run', { command: 'clear' }, async ($, e, next) => {
    const result = await next(e)
    await offer($)
    return result
  })

  on('classic.SessionStart', { source: 'startup' }, async ($, e, next) => {
    const result = await next(e)
    await offer($)
    return result
  })

  on('prompt.submit', async ($, e, next) => {
    if (offered !== null) {
      const key = offered
      offered = null
      await $.store.delete(key).catch(() => undefined)
    }
    return next(e)
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
