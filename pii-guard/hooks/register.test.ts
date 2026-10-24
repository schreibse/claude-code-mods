import { expect, test } from 'claude-code/testing'

const OPTIONS = { options: { identifiers: 'jane.doe@example.org, Jane Doe' } }

const CASES = [
  { name: 'curl with the email in a User-Agent', input: { tool: 'Bash', command: `curl -A 'bot (jane.doe@example.org)' https://commons.wikimedia.org/w/api.php` }, asks: true },
  { name: 'python urllib with the name', input: { tool: 'Bash', command: `python3 -c "import urllib.request as u; u.urlopen(u.Request('https://x.org', headers={'User-Agent':'JANE DOE'}))"` }, asks: true },
  { name: 'WebFetch with the email in the URL', input: { tool: 'WebFetch', url: 'https://x.org/?u=jane.doe@example.org', prompt: 'p' }, asks: true },
  { name: 'WebFetch with the email URL-encoded', input: { tool: 'WebFetch', url: 'https://x.org/?u=jane.doe%40example.org', prompt: 'p' }, asks: true },
  { name: 'browser form fill', input: { tool: 'mcp__claude-in-chrome__form_input', tabId: 1, ref: 'r', value: 'jane.doe@example.org' }, asks: true },
  { name: 'curl to localhost', input: { tool: 'Bash', command: `curl -H 'X: jane.doe@example.org' http://localhost:4300/api` }, asks: false },
  { name: 'local git config', input: { tool: 'Bash', command: `git config user.email jane.doe@example.org` }, asks: false },
  { name: 'curl without personal data', input: { tool: 'Bash', command: 'curl https://example.org' }, asks: false },
] as const

for (const c of CASES) {
  test(`${c.asks ? 'asks' : 'passes'}: ${c.name}`, OPTIONS, async ($, on) => {
    let reachedBelow = false
    on('classic.PreToolUse', () => {
      reachedBelow = true
      return {}
    })
    on('tool.call', () => ({ result: {} }))

    await $.tool.call(c.input as never)
    expect(reachedBelow).toBe(!c.asks)
  })
}

test('passes everything when no identifiers are configured', async ($, on) => {
  let reachedBelow = false
  on('classic.PreToolUse', () => {
    reachedBelow = true
    return {}
  })
  on('tool.call', () => ({ result: {} }))

  await $.tool.call({ tool: 'Bash', command: `curl -A 'jane.doe@example.org' https://x.org` })
  expect(reachedBelow).toBe(true)
})
