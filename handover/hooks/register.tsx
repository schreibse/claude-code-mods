import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { choicesFor, dirOf, dropIndex, isFresh, isHandoverKey, isPastedIn, sentenceOf, storeKey } from './rules'
import type { Entry } from './rules'
import type { Handover } from '../types'

const COPY_COMMAND = 'handover-copy'
const PICK_COMMAND = 'handover-pick'
const SAVE_TOOL = 'HandoverSave'
const SAVE_TOOL_ID = `mcp__handover__${SAVE_TOOL}` as const
const LIST_TOOL = 'HandoverList'
const LIST_TOOL_ID = `mcp__handover__${LIST_TOOL}` as const
const NONE_HERE = 'No handover for this repo or folder.'
const OFFER_EVERY_MS = 500
const OFFER_TRIES = 20
const PREVIEW_CHARS = 160

const pending = atom({ plugin: 'handover', key: 'pending' } as const, null)
const choices = atom({ plugin: 'handover', key: 'choices' } as const, null)
// The file the session last wrote: the skill updates the plan file, in the repo, just before the sentence.
const lastEdit = atom({ plugin: 'handover', key: 'lastEdit' } as const, null)

// The key of the sentence last offered in the box; the next prompt sent spends it.
let offered: string | null = null
// The list the band and the last bare /handover-pick numbered, so /handover-pick N picks what was shown.
let listed: Entry[] = []

async function entries($: EngineInterface): Promise<Entry[]> {
  const found: Entry[] = []
  for (const key of await $.store.keys()) {
    if (isHandoverKey(key)) {
      found.push({ key, handover: (await $.store.get(key)) as Handover })
    }
  }
  return found
}

async function remove($: EngineInterface, key: string): Promise<void> {
  await $.store.delete(key).catch(() => undefined)
}

async function noteEdit<R extends { isError?: boolean }>($: EngineInterface, path: string, result: R): Promise<R> {
  if (!result.isError) {
    await update($, lastEdit, () => path)
  }
  return result
}

async function repoOf($: EngineInterface, dir: string): Promise<string | null> {
  const found = await $.process.run(['git', '-C', dir, 'rev-parse', '--show-toplevel']).catch(() => null)
  return found?.exitCode === 0 && found.stdout.trim() !== '' ? found.stdout.trim() : null
}

// A sentence belongs to the repo its work was in, which a session started in a parent folder only shows
// through the files it wrote; outside any repo it stays with the folder the session started in.
async function place($: EngineInterface, edited: string | null): Promise<string> {
  const root = await $.session.root()
  return (edited === null ? null : await repoOf($, dirOf(edited))) ?? (await repoOf($, root)) ?? root
}

async function choicesHere($: EngineInterface): Promise<Entry[]> {
  listed = choicesFor(await entries($), await place($, null), await $.clock.now())
  return listed
}

// Numbers shift once an entry leaves, so the list and a band showing it are renumbered together.
async function relist($: EngineInterface): Promise<void> {
  const here = await choicesHere($)
  await update($, choices, shown => (shown === null || here.length === 0 ? null : here.map(c => c.handover.text)))
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

function numbered(here: readonly Entry[]): string {
  return here.map((c, i) => `${i + 1}. ${c.handover.text}`).join('\n\n')
}

function preview(text: string): string {
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS - 1)}…` : text
}

export const register: Register = on => {
  // Every session's sentence goes to a key of its own, so parallel sessions never overwrite one another.
  on('tool.call', { tool: SAVE_TOOL_ID }, async ($, e) => {
    const { sentence } = e as unknown as { sentence?: unknown }
    const text = typeof sentence === 'string' ? sentenceOf(sentence) : ''
    if (text === '') {
      return { deny: `${SAVE_TOOL} takes { sentence: string }, the handover sentence alone.` }
    }
    const handover: Handover = { text, at: await $.clock.now(), root: await place($, await read($, lastEdit)) }
    await $.store.set(storeKey(await $.session.id()), handover)
    await update($, pending, () => text)
    return { result: 'Handover saved: it shows in the band, and after /clear it waits in the prompt.' }
  })

  // While the band shows a list, "handover N" means its line N, though another session wrote since.
  on('tool.call', { tool: LIST_TOOL_ID }, async $ => {
    const here = (await read($, choices)) !== null ? listed : await choicesHere($)
    return { result: here.length === 0 ? NONE_HERE : numbered(here) }
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => noteEdit($, e.file_path, await next(e)))
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => noteEdit($, e.file_path, await next(e)))

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
    const pasted = (await entries($)).filter(({ handover }) => isPastedIn(e.text, handover.text))
    for (const { key } of pasted) {
      await remove($, key)
    }
    if (pasted.length > 0) {
      await relist($)
    }
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: SAVE_TOOL,
      description: 'Saves the handover sentence a cold session continues from (the handover skill says when and what). Send the sentence alone.',
      inputSchema: {
        type: 'object',
        properties: { sentence: { type: 'string', minLength: 1 } },
        required: ['sentence'],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: LIST_TOOL,
      description: 'Lists the open handover sentences of this repo (or folder, outside a repo), numbered as the band shows them, newest first.',
      inputSchema: { type: 'object', properties: {} },
    })
    await $.command.register({ name: COPY_COMMAND, description: 'Copy the handover sentence and hide its band' })
    await $.command.register({ name: PICK_COMMAND, description: 'List the handovers for this repo (or folder, outside a repo); /handover-pick N puts one in the prompt, /handover-pick drop N removes it' })
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
    const dropped = dropIndex(e.args)
    const n = dropped ?? Number(e.args.trim())
    const here = e.args.trim() === '' || listed.length === 0 ? await choicesHere($) : listed
    const chosen = Number.isInteger(n) ? here[n - 1] : undefined
    if (here.length === 0) {
      return { text: NONE_HERE }
    }
    if (dropped !== null && chosen !== undefined) {
      await remove($, chosen.key)
      await relist($)
      return { text: `Handover ${dropped} dropped.` }
    }
    if (chosen === undefined) {
      await update($, choices, shown => (shown === null ? null : here.map(c => c.handover.text)))
      return { text: numbered(here) }
    }
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
              <Text color="cyan" bold>handovers here </Text>
              <Text dimColor>/{PICK_COMMAND} N puts one in the prompt · /{PICK_COMMAND} drop N removes it</Text>
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
