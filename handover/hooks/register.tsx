import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { choicesFor, handoverPath, isFresh, sentenceOf, sessionIdOf, sessionPath, storeKey } from './rules'
import type { Entry } from './rules'
import type { Handover } from '../types'

const COPY_COMMAND = 'handover-copy'
const PICK_COMMAND = 'handover'
const OFFER_EVERY_MS = 500
const OFFER_TRIES = 20
const PREVIEW_CHARS = 160

const pending = atom({ plugin: 'handover', key: 'pending' } as const, null)
const choices = atom({ plugin: 'handover', key: 'choices' } as const, null)

// The key of the sentence last offered in the box; the next prompt sent spends it.
let offered: string | null = null

async function home($: EngineInterface): Promise<string> {
  return (await $.env.get('HOME')) ?? ''
}

async function entries($: EngineInterface): Promise<Entry[]> {
  const found: Entry[] = []
  for (const key of await $.store.keys()) {
    if (sessionIdOf(key) !== null) {
      found.push({ key, handover: (await $.store.get(key)) as Handover })
    }
  }
  return found
}

async function remove($: EngineInterface, key: string): Promise<void> {
  await $.store.delete(key).catch(() => undefined)
  const sessionId = sessionIdOf(key)
  const dir = await home($)
  if (sessionId !== null && dir !== '') {
    await $.process.run(['rm', '-f', sessionPath(dir, sessionId)]).catch(() => undefined)
  }
}

async function choicesHere($: EngineInterface): Promise<Entry[]> {
  return choicesFor(await entries($), await $.session.root(), await $.clock.now())
}

function suggest($: EngineInterface, key: string, text: string): void {
  offered = key
  // The box refuses while the /clear's own turn still runs, and a reset of the box right after
  // can drop a suggestion it had taken, so the same text is proposed again for a while.
  let tries = 0
  const timer = $.clock.every(OFFER_EVERY_MS, async () => {
    if (++tries > OFFER_TRIES || offered !== key) {
      timer.cancel()
      return
    }
    await $.prompt.suggest({ text })
  })
}

function preview(text: string): string {
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS - 1)}…` : text
}

export const register: Register = on => {
  // Every session's sentence goes to a file and a key of its own, so parallel sessions never overwrite one another.
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const dir = await home($)
    const sessionId = await $.session.id()
    const target = sessionPath(dir, sessionId)
    if (dir === '' || (e.file_path !== handoverPath(dir) && e.file_path !== target)) {
      return next(e)
    }
    const result = await next({ ...e, file_path: target })
    if (result.isError) {
      return result
    }
    const text = sentenceOf(e.content)
    const handover: Handover = { text, at: await $.clock.now(), root: await $.session.root() }
    await $.store.set(storeKey(sessionId), handover)
    await update($, pending, () => text)
    return result
  })

  // A /clear fires no session.start; the id read before it runs is the session that wrote the sentence.
  on('command.run', { command: 'clear' }, async ($, e, next) => {
    const key = storeKey(await $.session.id())
    const result = await next(e)
    const stored = (await $.store.get(key)) as Handover | undefined
    if (isFresh(stored, await $.clock.now())) {
      await update($, pending, () => null)
      suggest($, key, stored.text)
    }
    return result
  })

  // A new process cannot tell which of a repo's sessions it continues, so it lists them and the person picks.
  on('classic.SessionStart', { source: 'startup' }, async ($, e, next) => {
    const result = await next(e)
    const now = await $.clock.now()
    for (const { key, handover } of await entries($)) {
      if (!isFresh(handover, now)) {
        await remove($, key)
      }
    }
    const here = await choicesHere($)
    await update($, choices, () => (here.length > 0 ? here.map(c => c.handover.text) : null))
    return result
  })

  on('prompt.submit', async ($, e, next) => {
    if (offered !== null) {
      const key = offered
      offered = null
      await remove($, key)
    }
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COPY_COMMAND, description: 'Copy the handover sentence and hide its band' })
    await $.command.register({ name: PICK_COMMAND, description: 'List this repo\'s handovers; /handover N puts one in the prompt' })
    return next(e)
  })

  // A band's buttons take a press only once it holds focus, so copying is a command typed at the prompt.
  on('command.run', { command: COPY_COMMAND }, async $ => {
    const text = await read($, pending) ?? ((await $.store.get(storeKey(await $.session.id()))) as Handover | undefined)?.text
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

  on('command.run', { command: PICK_COMMAND }, async ($, e) => {
    const here = await choicesHere($)
    if (here.length === 0) {
      return { text: 'No handover for this repo.' }
    }
    const n = Number(e.args.trim())
    if (!Number.isInteger(n) || n < 1 || n > here.length) {
      return { text: here.map((c, i) => `${i + 1}. ${c.handover.text}`).join('\n\n') }
    }
    const chosen = here[n - 1]
    await update($, choices, () => null)
    suggest($, chosen.key, chosen.handover.text)
    return { text: `Handover ${n} waits in the prompt; Tab takes it.` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const text = await read($, pending)
    const listed = await read($, choices)
    const band = await next(e)
    if ((text === null && listed === null) || e.props.hasSurvey) {
      return band
    }
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {band}
        {text !== null && (
          <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="cyan">
            <Box>
              <Text color="cyan" bold>handover </Text>
              <Text dimColor>/{COPY_COMMAND} to copy · /clear, then Tab</Text>
            </Box>
            <Text>{text}</Text>
          </Box>
        )}
        {listed !== null && (
          <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="cyan">
            <Box>
              <Text color="cyan" bold>handovers for this repo </Text>
              <Text dimColor>/{PICK_COMMAND} N puts one in the prompt</Text>
            </Box>
            {listed.map((t, i) => (
              <Text key={String(i)}>{`${i + 1}. ${preview(t)}`}</Text>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}
