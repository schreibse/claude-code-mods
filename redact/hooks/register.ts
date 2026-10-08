import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { dropped, judge, parseReport, pathWords, seal, unsealFields } from './vault'
import type { Finding } from './vault'

const vault = atom({ plugin: 'redact', key: 'vault' } as const, {})

const SEALED_DOORS = new Set(['prompt', 'command', 'tool-result', 'tool-message', 'delivery', 'attachment', 'hook-context'])
const SCANNER = ['betterleaks', 'stdin', '--no-banner', '--log-level', 'error', '--report-format', 'json', '--report-path', '-', '--exit-code', '0']

const MAX_SOURCE_FILES = 10
const MAX_SOURCE_BYTES = 1_000_000

let hasScanner = true
let isScanFailing = false
let home = ''

async function findSecrets($: EngineInterface, text: string): Promise<Finding[]> {
  if (!hasScanner || text.length === 0) {
    return []
  }
  const run = await $.process.run([...SCANNER, '--config', `${$.plugin.root}/betterleaks.toml`], { stdin: text }).catch(() => null)
  const findings = run?.exitCode === 0 ? reportOrNull(run.stdout) : null
  if (findings === null) {
    if (!isScanFailing) {
      $.ui.toast('betterleaks failed, this output is NOT redacted')
    }
    isScanFailing = true
    $.ui.status('off (betterleaks)')
    return []
  }
  if (isScanFailing) {
    isScanFailing = false
    const count = Object.keys(await read($, vault)).length
    $.ui.status(count > 0 ? `redacted ${count}` : undefined)
  }
  return findings
}

function reportOrNull(stdout: string): Finding[] | null {
  try {
    return parseReport(stdout)
  } catch {
    return null
  }
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
  for (const rule of new Set(added.map(finding => finding.rule))) {
    $.ui.toast(`hid a ${rule} value from the model`)
  }
  if (count > 0 && !isScanFailing) {
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

// Output cut short (`cut -c1-60`, Read with a limit) loses the context a rule needs, so the
// whole source file is scanned first and its values are hidden wherever they show up.
async function sealSourceFiles($: EngineInterface, call: { tool: string }): Promise<void> {
  const input = call as { tool: string; file_path?: unknown; path?: unknown; command?: unknown }
  const candidates =
    input.tool === 'Bash' && typeof input.command === 'string'
      ? pathWords(input.command, await $.session.cwd(), home)
      : [input.file_path, input.path].filter((path): path is string => typeof path === 'string')
  let sealedFiles = 0
  for (const path of candidates) {
    if (sealedFiles === MAX_SOURCE_FILES) {
      break
    }
    const stat = await $.fs.stat(path).catch(() => null)
    if (stat?.kind === 'file' && stat.size <= MAX_SOURCE_BYTES) {
      sealedFiles++
      await sealText($, await $.fs.read(path).catch(() => ''))
    }
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    home = (await $.env.get('HOME')) ?? ''
    const probe = await $.process.run(['betterleaks', 'version']).catch(() => null)
    hasScanner = probe?.exitCode === 0
    isScanFailing = false
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
    await sealSourceFiles($, e)
    const call = verdict.restore ? unsealFields(e, known) : e

    // A whole-file Write written from memory can silently leave out a value the model never saw.
    if (call.tool === 'Write') {
      const { file_path: path, content } = call as typeof call & { file_path: string; content: string }
      const before = (await $.fs.stat(path).catch(() => null))?.kind === 'file' ? await $.fs.read(path).catch(() => '') : ''
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
