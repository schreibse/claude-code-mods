import { expect, test } from 'claude-code/testing'

const BAND = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100 } as never

test('open asks are drawn above the other bands, which stay', async ($, on) => {
  on('state.get', { plugin: 'needs-you', key: 'asks' }, () => ({ value: { value: ['look at the band'], version: 1 } }) as never)
  const ui = await $.ui.mount({ plugin: 'needs-you', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ type: 'Text', text: /look at the band/ })).toBeDefined()
  expect(await ui.keepsBeneath()).toBe(true)
  await ui.unmount()
})
