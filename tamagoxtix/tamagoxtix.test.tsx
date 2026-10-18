import { describe, expect, mock, test } from 'claude-code/testing'

import { CHEER_SCENES, FX_WIDTH, IDLE_SCENES, WORK_SCENES, scene } from './lib/scenes.mjs'

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const
const SPINNER = { word: 'Coalescing', message: null, suffix: '…', mode: 'thinking' } as const

// the band hands the render on to the mods beneath it; in a test nothing is there, so an empty box answers
type On = Parameters<Parameters<typeof test>[1]>[1]
const emptyBandBelow = (on: On) =>
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

describe('tamagoxtix', () => {
  test('the spinner becomes the monster once the session has started', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    await $.session.start(START)
    const drawn = await $.ui.render({
      surface: 'terminal',
      component: 'Spinner',
      requestId: 'main',
      props: SPINNER,
    })
    expect(JSON.stringify(drawn)).toContain('spinner.tsx')
  })

  test('the spinner module draws the monster and the clock', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    await $.session.start(START)
    for (const mode of ['requesting', 'thinking', 'tool-use', 'responding'] as const) {
      const ui = await $.ui.mount({
        plugin: 'tamagoxtix',
        surface: 'terminal',
        component: 'Spinner',
        props: { ...SPINNER, mode },
      })
      for (let i = 0; i < 6; i++) await ui.advance(160)
      expect(await ui.find({ in: 'tamagoxtix-spinner', type: 'Text', text: /Coalescing/ })).toBeDefined()
      expect(await ui.find({ in: 'tamagoxtix-spinner', type: 'Text', text: /esc to interrupt/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('between turns the monster hangs out above the prompt, scene after scene', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    emptyBandBelow(on)
    await $.session.start(START)
    const ui = await $.ui.mount({
      plugin: 'tamagoxtix',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100 } as never,
    })
    // two minutes of frames: several idle scenes go by
    for (let i = 0; i < 400; i++) await ui.advance(320)
    expect(await ui.find({ in: 'tamagoxtix-idle', type: 'Text', text: /waiting for you/ })).toBeDefined()
    await ui.unmount()
  })

  test('the band keeps the bands the other mods draw', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>handover: resume the band test</Text>
    })
    await $.session.start(START)
    const ui = await $.ui.mount({
      plugin: 'tamagoxtix',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100 } as never,
    })
    await ui.advance(320)
    expect(await ui.find({ in: 'tamagoxtix-idle', type: 'Text', text: /waiting for you|monster/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /handover: resume the band test/ })).toBeDefined()
    await ui.unmount()
  })

  test('while you type a prompt the monster cheers you on', async ($, on) => {
    // the bottom of prompt.edit stands for the editor: the splice applied
    on('prompt.edit', ($, e) => {
      const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
      return { text, cursor: e.start + e.inputText.length }
    })
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    emptyBandBelow(on)
    await $.session.start(START)
    const type = (text: string, inputText: string) =>
      $.prompt.edit({ origin: { kind: 'composer' }, text, cursor: text.length, start: text.length, end: text.length, inputText })
    const band = async (surface: 'terminal' | 'desktop') => {
      const ui = await $.ui.mount({
        plugin: 'tamagoxtix',
        surface,
        component: 'AbovePrompt',
        props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100 } as never,
      })
      for (let i = 0; i < 40; i++) await ui.advance(320)
      const cheering = (await ui.find({ in: 'tamagoxtix-idle', type: 'Text', text: /enter to send/ })) !== undefined
      await ui.unmount()
      return cheering
    }
    // a slash command is no prompt: the monster keeps idling
    await type('', '/tamagoxtix')
    expect(await band('terminal')).toBe(false)
    await type('', 'fix the flaky test')
    for (const surface of ['terminal', 'desktop'] as const) expect(await band(surface)).toBe(true)
  })

  test('/tamagoxtix prints a usage card from the numbers on disk', async ($, on) => {
    const day = (date: string, tokens: number) => ({ date, tokens, output: tokens / 100 })
    const usage = {
      generatedAt: 0,
      days: Array.from({ length: 14 }, (_, i) => day(`2026-10-${String(i + 1).padStart(2, '0')}`, i * 1e6)),
      today: { date: '2026-10-14', tokens: 13e6, output: 130e3, hours: Array.from({ length: 24 }, (_, hour) => ({ hour, tokens: hour * 1e5 })) },
      session: { start: 0, end: 0, tokens: 5e6 },
      week: { start: 0, tokens: 40e6 },
    }
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    on('process.run', ($, e) =>
      e.argv.some(a => a.endsWith('usage-node.mjs'))
        ? { value: { exitCode: 0, stdout: JSON.stringify(usage), stderr: '' } }
        : { value: { exitCode: 1, stdout: '', stderr: '' } },
    )
    await $.session.start(START)
    const result = await $.command.run({
      command: 'tamagoxtix',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 100 },
    })
    expect(result.text).toContain('today 13M')
    const ui = await $.ui.mount({
      plugin: 'tamagoxtix',
      surface: 'terminal',
      component: 'CommandOutput',
      props: { command: 'tamagoxtix', args: '', text: result.text ?? '', isErrored: false } as never,
    })
    expect(await ui.find({ type: 'Text', text: /last 14 days/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /today by hour/ })).toBeDefined()
    await ui.unmount()
  })

  test('/tamagoxtix help lists the commands and draws them as a card', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    await $.session.start(START)
    const result = await $.command.run({
      command: 'tamagoxtix',
      args: 'help',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 100 },
    })
    for (const part of ['palette <name>', 'theme on|off', 'statusline on|off', 'pet on|off', 'tamagoxtix.palette-next']) {
      expect(result.text).toContain(part)
    }
    const ui = await $.ui.mount({
      plugin: 'tamagoxtix',
      surface: 'terminal',
      component: 'CommandOutput',
      props: { command: 'tamagoxtix', args: 'help', text: result.text ?? '', isErrored: false } as never,
    })
    expect(await ui.find({ type: 'Text', text: /statusline on\|off/ })).toBeDefined()
    await ui.unmount()
  })

  test('the desktop app draws the spinner, the idle band and the cards too', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    emptyBandBelow(on)
    await $.session.start(START)

    const drawn = await $.ui.render({ surface: 'desktop', component: 'Spinner', requestId: 'main', props: SPINNER })
    expect(JSON.stringify(drawn)).toContain('spinner.tsx')

    const spinner = await $.ui.mount({ plugin: 'tamagoxtix', surface: 'desktop', component: 'Spinner', props: { ...SPINNER, mode: 'tool-use' } })
    for (let i = 0; i < 6; i++) await spinner.advance(160)
    expect(await spinner.find({ in: 'tamagoxtix-spinner', type: 'Text', text: /esc to interrupt/ })).toBeDefined()
    await spinner.unmount()

    const band = await $.ui.mount({
      plugin: 'tamagoxtix',
      surface: 'desktop',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100 } as never,
    })
    for (let i = 0; i < 20; i++) await band.advance(320)
    expect(await band.find({ in: 'tamagoxtix-idle', type: 'Text', text: /waiting for you/ })).toBeDefined()
    await band.unmount()

    const help = await $.command.run({ command: 'tamagoxtix', args: 'help', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
    const card = await $.ui.mount({
      plugin: 'tamagoxtix',
      surface: 'desktop',
      component: 'CommandOutput',
      props: { command: 'tamagoxtix', args: 'help', text: help.text ?? '', isErrored: false } as never,
    })
    expect(await card.find({ type: 'Text', text: /statusline on\|off/ })).toBeDefined()
    await card.unmount()
  })

  // an in-memory disk for the settings tests
  function memoryFs(on: Parameters<Parameters<typeof test>[1]>[1], files: Map<string, string>) {
    on('fs.exists', ($, e) => ({ value: files.has((e as { path: string }).path) }))
    on('fs.read', ($, e) => {
      const path = (e as { path: string }).path
      if (files.has(path)) return { value: files.get(path) as string }
      if (path.includes('/scripts/')) return { value: '// script' }
      throw new Error(`ENOENT ${path}`)
    })
    on('fs.write', ($, e) => {
      const { path, text } = e as { path: string; text: string }
      files.set(path, text)
      return { value: undefined }
    })
  }

  test('a settings.json that is not valid JSON is never overwritten', async ($, on) => {
    const files = new Map([['/home/me/.claude/settings.json', '{ "model": "opus", }']])
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/home/me' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    memoryFs(on, files)
    await $.session.start(START)
    for (const args of ['statusline on', 'theme on', 'statusline off', 'theme off']) {
      const result = await $.command.run({ command: 'tamagoxtix', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
      expect(result.text).toContain('not valid JSON')
    }
    expect(files.get('/home/me/.claude/settings.json')).toBe('{ "model": "opus", }')
    expect(files.has('/home/me/.claude/settings.json.tamagoxtix-backup')).toBe(false)
  })

  test('statusline and theme change their own keys, keep the rest, and back the file up once', async ($, on) => {
    const original = JSON.stringify({ model: 'opus', permissions: { allow: ['Bash(ls)'] }, theme: 'dark' }, null, 2)
    const files = new Map([['/home/me/.claude/settings.json', original]])
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/home/me' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    memoryFs(on, files)
    await $.session.start(START)
    const run = (args: string) =>
      $.command.run({ command: 'tamagoxtix', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
    await run('statusline on')
    await run('theme on')
    let settings = JSON.parse(files.get('/home/me/.claude/settings.json') ?? '{}')
    expect(settings.model).toBe('opus')
    expect(settings.permissions).toEqual({ allow: ['Bash(ls)'] })
    expect(settings.theme).toBe('custom:tamagoxtix')
    expect(String(settings.statusLine?.command)).toContain('statusline.mjs')
    expect(files.get('/home/me/.claude/settings.json.tamagoxtix-backup')).toBe(original)
    await run('statusline off')
    await run('theme off')
    settings = JSON.parse(files.get('/home/me/.claude/settings.json') ?? '{}')
    expect(settings).toEqual({ model: 'opus', permissions: { allow: ['Bash(ls)'] }, theme: 'dark' })
  })

  test('/tamagoxtix doctor reports what is there and what is missing', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    on('process.run', ($, e) => {
      const [cmd] = e.argv
      if (cmd === 'node') return { value: { exitCode: 0, stdout: 'v16.20.0\n', stderr: '' } }
      if (cmd === 'git') return { value: { exitCode: 0, stdout: 'git version 2.47.0\n', stderr: '' } }
      throw new Error('ENOENT')
    })
    await $.session.start(START)
    const result = await $.command.run({ command: 'tamagoxtix', args: 'doctor', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
    expect(result.text).toContain('✖ Node.js 18+')
    expect(result.text).toContain('install: https://nodejs.org')
    expect(result.text).toContain('✔ git')
    expect(result.text).toContain('○ gh (GitHub CLI)')
    expect(result.text).toContain('/tamagoxtix icons plain')
  })

  test('with under 3 rows the band shrinks to one line, and doctor says why', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    emptyBandBelow(on)
    await $.session.start(START)
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({
        plugin: 'tamagoxtix',
        surface,
        component: 'AbovePrompt',
        props: { hasSurvey: false, isWorking: false, maxRows: 2, bodyColumns: 100 } as never,
      })
      await ui.advance(320)
      expect(await ui.find({ in: 'tamagoxtix-idle', type: 'Text', text: /waiting for you/ })).toBeUndefined()
      expect(await ui.find({ in: 'tamagoxtix-idle', type: 'Text', text: /^ [a-z]/ })).toBeDefined()
      await ui.unmount()
    }
    const result = await $.command.run({ command: 'tamagoxtix', args: 'doctor', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
    expect(result.text).toContain('Monster band: on')
    expect(result.text).toContain('100 columns, room for scene only')
    expect(result.text).toContain('shrinks to one line')
  })

  test('outside a repository git is asked once, not on every turn', async ($, on) => {
    let remotes = 0
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('session.cwd', () => ({ value: '/tmp/not-a-repo' }))
    on('store.get', () => ({ value: undefined }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    on('process.run', ($, e) => {
      if (e.argv[0] === 'git') {
        remotes++
        return { value: { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' } }
      }
      throw new Error('ENOENT')
    })
    await $.session.start(START)
    await $.session.start(START)
    await $.session.start(START)
    expect(remotes).toBe(1)
  })

  test('the repo column reads stars, issues, pull requests and CI from gh', async ($, on) => {
    const asked: string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    const clock = mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('session.cwd', () => ({ value: '/tmp/repo' }))
    on('store.get', () => ({ value: undefined }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    emptyBandBelow(on)
    on('process.run', ($, e) => {
      const cmd = e.argv.join(' ')
      asked.push(cmd)
      const out = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '' } })
      if (cmd === 'git remote get-url origin') return out('git@github.com:octo/demo.git\n')
      if (cmd === 'git rev-parse --abbrev-ref HEAD') return out('main\n')
      if (cmd.startsWith('git ')) return out('')
      if (cmd === 'gh api repos/octo/demo') return out(JSON.stringify({ open_issues_count: 7, stargazers_count: 42 }))
      if (cmd.startsWith('gh pr list -R octo/demo')) return out(JSON.stringify([{ number: 1 }, { number: 2 }]))
      if (cmd.startsWith('gh run list -R octo/demo --branch main')) return out(JSON.stringify([{ status: 'completed', conclusion: 'success' }]))
      throw new Error('ENOENT')
    })
    on('http.fetch', () => {
      throw new Error('no network in this test')
    })
    await $.session.start(START)
    // the repo column is refreshed in the background after the start
    await clock.advance(1)
    const ui = await $.ui.mount({
      plugin: 'tamagoxtix',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 200 } as never,
    })
    await ui.advance(320)
    expect(asked).toContain('gh api repos/octo/demo')
    expect(await ui.find({ in: 'tamagoxtix-idle', type: 'Text', text: /42/ })).toBeDefined()
    // 7 open issues on GitHub include the 2 pull requests
    expect(await ui.find({ in: 'tamagoxtix-idle', type: 'Text', text: /\b5\b/ })).toBeDefined()
    await ui.unmount()
  })

  test('without node the idle band says how to get the usage numbers', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    emptyBandBelow(on)
    on('process.run', () => {
      throw new Error('ENOENT')
    })
    await $.session.start(START)
    await $.command.run({ command: 'tamagoxtix', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
    const band = await $.ui.mount({
      plugin: 'tamagoxtix',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100 } as never,
    })
    await band.advance(320)
    expect(await band.find({ in: 'tamagoxtix-idle', type: 'Text', text: /install Node\.js 18\+/ })).toBeDefined()
    await band.unmount()
  })

  test('/tamagoxtix palette lists every palette', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    await $.session.start(START)
    const result = await $.command.run({
      command: 'tamagoxtix',
      args: 'palette',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 100 },
    })
    expect(result.text).toContain('omarchy')
    expect(result.text).toContain('tokyo-night')
  })

  test('an unknown palette is refused without writing anything', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    mock.env(on, { HOME: '/nonexistent' })
    mock.clock(on, { now: Date.parse('2026-10-14T12:00:00Z') })
    on('session.id', () => ({ value: 'test-session' }))
    on('command.register', () => ({ value: { command: 'tamagoxtix' } }))
    await $.session.start(START)
    const result = await $.command.run({
      command: 'tamagoxtix',
      args: 'palette nope',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 100 },
    })
    expect(result.text).toContain('Unknown palette')
  })

  test('no effect is wider than the padded effects column, so the text beside the scene stays put', async () => {
    const monster = { seed: 'test', name: 'Mo' } as never
    for (const name of [...IDLE_SCENES, ...WORK_SCENES, ...CHEER_SCENES]) {
      for (let frame = 0; frame < 120; frame++) {
        for (const row of scene(monster, name, frame).fx) expect([...row].length).toBe(FX_WIDTH)
      }
    }
  })

})
