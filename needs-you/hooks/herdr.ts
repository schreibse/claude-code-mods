import type { EngineInterface } from 'claude-code'

export const ASK_ICON = '⏸'
export const PICK_ICON = '?'

// herdr draws the `$ask` / `$pick` tokens in ui.sidebar.agents.rows of ~/.config/herdr/config.toml.
export async function setToken($: EngineInterface, name: 'ask' | 'pick', value: string | null): Promise<void> {
  const pane = await $.env.get('HERDR_PANE_ID')
  if (!pane) {
    return
  }
  const herdr = `${(await $.env.get('HOME')) ?? ''}/.local/bin/herdr`
  const change = value === null ? ['--clear-token', name] : ['--token', `${name}=${value}`]
  await $.process.run([herdr, 'pane', 'report-metadata', pane, '--source', `needs-you-${name}`, ...change]).catch(() => null)
}
