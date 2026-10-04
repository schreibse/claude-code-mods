import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { dropped, judge, parseReport, seal, unsealFields } from './vault'
import type { Finding } from './vault'

const vault = atom({ plugin: 'redact', key: 'vault' } as const, {})

const SEALED_DOORS = new Set(['prompt', 'command', 'tool-result', 'tool-message', 'delivery', 'attachment', 'hook-context'])
const SCANNER = ['betterleaks', 'stdin', '--no-banner', '--log-level', 'error', '--report-format', 'json', '--report-path', '-', '--exit-code', '0']

let hasScanner = true

async function findSecrets($: EngineInterface, text: string): Promise<Finding[]> {
  if (!hasScanner || text.length === 0) {
    return []
  }
  const run = await $.process.run([...SCANNER, '--config', `${$.plugin.root}/betterleaks.toml`], { stdin: text }).catch(() => null)
  if (run === null || run.exitCode !== 0) {
    hasScanner = false
    $.ui.toast('betterleaks failed, secrets are NOT being hidden')
    $.ui.status('off (betterleaks)')
    return []
  }
  return parseReport(run.stdout)
}

async function sealText($: EngineInterface, text: string, findings?: readonly Finding[]): Promise<string> {
  const found = findings ?? (await findSecrets($, text))
  let sealed = text
  let added: Finding[] = []
  const count = Object.keys(
    await update($, vault, current => {
      const result = seal(text, current, found)
      sealed = result.text
      added = result.added
      return result.vault
    }),
  ).length
  for (const finding of added) {
    $.ui.toast(`hid a ${finding.rule} value from the model`)
  }
  if (count > 0) {
    $.ui.status(`redacted ${count}`)
  }
  return sealed
}

type Block = { type: string; text?: string; content?: string | Block[] }

async function sealBlocks($: EngineInterface, blocks: readonly Block[]): Promise<Block[]> {
  return Promise.all(
    blocks.map(async block => {
      if (block.type === 'text' && typeof block.text === 'string') {
        return { ...block, text: await sealText($, block.text) }
      }
      if (block.type === 'tool_result' && typeof block.content === 'string') {
        return { ...block, content: await sealText($, block.content) }
      }
      if (block.type === 'tool_result' && Array.isArray(block.content)) {
        return { ...block, content: await sealBlocks($, block.content) }
      }
      return block
    }),
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const probe = await $.process.run(['betterleaks', 'version']).catch(() => null)
    hasScanner = probe?.exitCode === 0
    $.ui.status(undefined)
    if (!hasScanner) {
      $.ui.toast('betterleaks is not installed, secrets are NOT being hidden')
      $.ui.status('off (no betterleaks)')
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => next({ ...e, text: await sealText($, e.text) }))

  on('session.append', async ($, e, next) => {
    if (!SEALED_DOORS.has(e.door)) {
      return next(e)
    }
    const content = (await sealBlocks($, e.message.content as readonly Block[])) as typeof e.message.content
    return next({ ...e, message: { ...e.message, content } })
  })

  on('tool.call', async ($, e, next) => {
    const known = await read($, vault)
    const verdict = judge(e.tool, JSON.stringify(e), known)
    if ('deny' in verdict) {
      return { deny: verdict.deny }
    }
    const call = verdict.restore ? unsealFields(e, known) : e

    // A whole-file Write written from memory can silently leave out a value the model never saw.
    if (call.tool === 'Write') {
      const { file_path: path, content } = call as typeof call & { file_path: string; content: string }
      const before = (await $.fs.stat(path).catch(() => null))?.kind === 'file' ? await $.fs.read(path) : ''
      const findings = await findSecrets($, before)
      const secrets = [...Object.values(await read($, vault)).map(entry => entry.value), ...findings.map(finding => finding.secret)]
      const lost = dropped(before, content, secrets)
      if (lost.length > 0) {
        const named = await sealText($, lost.join(', '), findings)
        return { deny: `redact: this Write would drop ${named} from ${path}. Change the file with Edit instead; to remove a value on purpose, Edit with its token in old_string.` }
      }
    }
    return next(call)
  })
}
