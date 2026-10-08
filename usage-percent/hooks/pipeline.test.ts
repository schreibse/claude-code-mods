import { test, expect } from 'claude-code/testing'
import { hostOf, forgeOf, githubPipeline, gitlabPipeline, pipeline } from './pipeline'

test('github.com remotes use gh, Azure DevOps none, every other host glab', () => {
  expect(forgeOf('https://github.com/octocat/hello.git')).toBe('github')
  expect(forgeOf('git@github.com:octocat/hello.git')).toBe('github')
  expect(forgeOf('https://gitlab.example.com/acme/shop.git')).toBe('gitlab')
  expect(forgeOf('git@gitlab.example.org:x/y.git')).toBe('gitlab')
  expect(forgeOf('https://notgithub.com.example/x.git')).toBe('gitlab')
  expect(forgeOf('')).toBeNull()
  expect(forgeOf('https://acme@dev.azure.com/acme/shop/_git/shop')).toBeNull()
  expect(forgeOf('git@ssh.dev.azure.com:v3/acme/shop/shop')).toBeNull()
  expect(forgeOf('https://acme.visualstudio.com/shop/_git/shop')).toBeNull()
})

test('the host comes from https and ssh remotes alike', () => {
  expect(hostOf('https://gitlab.example.com/acme/x.git')).toBe('gitlab.example.com')
  expect(hostOf('git@gitlab.example.org:x/y.git')).toBe('gitlab.example.org')
  expect(hostOf('ssh://git@github.com:22/a/b.git')).toBe('github.com')
  expect(hostOf('')).toBe('')
})

test('gitlab pipelines: running stage, failed job names, blocked on a manual job', () => {
  const jobs = [{ name: 'lint', status: 'failed', stage: 'test' }, { name: 'unit', status: 'running', stage: 'test' }]
  expect(gitlabPipeline(JSON.stringify({ status: 'running', jobs }))).toEqual({ state: 'running', detail: 'test' })
  expect(gitlabPipeline(JSON.stringify({ status: 'failed', jobs }))).toEqual({ state: 'failed', detail: 'lint' })
  expect(gitlabPipeline(JSON.stringify({ status: 'manual', jobs: [] }))).toEqual({ state: 'manual', detail: '' })
  expect(gitlabPipeline(JSON.stringify({ status: 'success', jobs: [] }))).toEqual({ state: 'passed', detail: '' })
  expect(gitlabPipeline(JSON.stringify({ status: 'canceled' }))).toEqual({ state: 'failed', detail: '' })
  expect(gitlabPipeline(JSON.stringify({ status: 'skipped' }))).toBeNull()
})

test('github runs: in progress, success, failure', () => {
  expect(githubPipeline(JSON.stringify([{ status: 'in_progress', workflowName: 'CI' }]))).toEqual({ state: 'running', detail: 'CI' })
  expect(githubPipeline(JSON.stringify([{ status: 'completed', conclusion: 'success', workflowName: 'CI' }]))).toEqual({ state: 'passed', detail: '' })
  expect(githubPipeline(JSON.stringify([{ status: 'completed', conclusion: 'failure', workflowName: 'CI' }]))).toEqual({ state: 'failed', detail: 'CI' })
  expect(githubPipeline(JSON.stringify([{ status: 'completed', conclusion: 'cancelled', workflowName: 'CI' }]))).toEqual({ state: 'failed', detail: 'CI' })
  expect(githubPipeline('[]')).toBeNull()
})

test('github runs waiting for an approval pause like a manual gitlab job', () => {
  for (const run of [{ status: 'waiting' }, { status: 'pending' }, { status: 'action_required' }, { status: 'completed', conclusion: 'action_required' }]) {
    expect(githubPipeline(JSON.stringify([{ ...run, workflowName: 'Deploy' }]))).toEqual({ state: 'manual', detail: 'Deploy' })
  }
})

const text = (pieces: readonly { text: string }[]) => pieces.map(p => p.text).join('')

test('pipeline text, coloured by outcome', () => {
  expect(text(pipeline({ state: 'running', detail: 'test' }))).toBe('ci ⏳ test')
  expect(text(pipeline({ state: 'passed', detail: '' }))).toBe('ci ✓')
  expect(text(pipeline({ state: 'manual', detail: '' }))).toBe('ci ⏸')
  expect(text(pipeline({ state: 'failed', detail: 'lint unit' }))).toBe('ci ✗ lint unit')
  expect(text(pipeline({ state: 'no-login', detail: 'gitlab.example.org' }))).toBe('ci no login (gitlab.example.org)')
  expect(pipeline({ state: 'failed', detail: 'lint' })[1]?.tone).toBe('red')
  expect(pipeline({ state: 'passed', detail: '' })[1]?.tone).toBe('green')
})

test('a workflow named CI adds nothing to the ci label', () => {
  expect(text(pipeline({ state: 'running', detail: 'CI' }))).toBe('ci ⏳')
})
