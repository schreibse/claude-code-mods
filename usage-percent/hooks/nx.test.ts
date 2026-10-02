import { test, expect } from 'claude-code/testing'
import { hostOf, forgeOf, githubPipeline, gitlabPipeline, memory, pipeline, pressureAvg10, servedProjects } from './nx'

test('memory shows slice usage, and pressure only when there is some', () => {
  expect(memory(3583266816, 12884901888, 0)).toBe('mem 3.3/12G')
  expect(memory(3583266816, 12884901888, 12.4)).toBe('mem 3.3/12G psi 12%')
  expect(memory(3583266816, 12884901888, 61)).toBe('mem 3.3/12G psi 61%▲')
  expect(memory(3583266816, Number('max'), 0)).toBe('mem 3.3G')
  expect(pressureAvg10('some avg10=7.25 avg60=0.00 avg300=0.00 total=1\nfull avg10=1.00')).toBe(7.25)
  expect(pressureAvg10('')).toBe(0)
})

test('served projects come from nx serve processes, once each', () => {
  const ps = [
    'npm exec nx serve api --host=0.0.0.0',
    'node /app/node_modules/.bin/nx serve api --host=0.0.0.0',
    'node ./node_modules/.bin/nx run admin:serve:development',
    'node ./node_modules/.bin/nx run admin:build',
    '/usr/bin/syncthing serve --no-browser',
  ].join('\n')
  expect(servedProjects(ps)).toEqual(['admin', 'api'])
})

test('github.com remotes use gh, every other host glab', () => {
  expect(forgeOf('https://github.com/octocat/hello.git')).toBe('github')
  expect(forgeOf('git@github.com:octocat/hello.git')).toBe('github')
  expect(forgeOf('https://gitlab.example.com/acme/shop.git')).toBe('gitlab')
  expect(forgeOf('git@gitlab.example.org:x/y.git')).toBe('gitlab')
  expect(forgeOf('https://notgithub.com.example/x.git')).toBe('gitlab')
  expect(forgeOf('')).toBeNull()
})

test('the host comes from https and ssh remotes alike', () => {
  expect(hostOf('https://gitlab.example.com/acme/x.git')).toBe('gitlab.example.com')
  expect(hostOf('git@gitlab.example.org:x/y.git')).toBe('gitlab.example.org')
  expect(hostOf('ssh://git@github.com:22/a/b.git')).toBe('github.com')
  expect(hostOf('')).toBe('')
})

test('gitlab pipelines: running stage, failed job names, manual counts as passed', () => {
  const jobs = [{ name: 'lint', status: 'failed', stage: 'test' }, { name: 'unit', status: 'running', stage: 'test' }]
  expect(gitlabPipeline(JSON.stringify({ status: 'running', jobs }))).toEqual({ state: 'running', detail: 'test' })
  expect(gitlabPipeline(JSON.stringify({ status: 'failed', jobs }))).toEqual({ state: 'failed', detail: 'lint' })
  expect(gitlabPipeline(JSON.stringify({ status: 'manual', jobs: [] }))).toEqual({ state: 'passed', detail: '' })
  expect(gitlabPipeline(JSON.stringify({ status: 'canceled' }))).toBeNull()
})

test('github runs: in progress, success, failure', () => {
  expect(githubPipeline(JSON.stringify([{ status: 'in_progress', workflowName: 'CI' }]))).toEqual({ state: 'running', detail: 'CI' })
  expect(githubPipeline(JSON.stringify([{ status: 'completed', conclusion: 'success', workflowName: 'CI' }]))).toEqual({ state: 'passed', detail: '' })
  expect(githubPipeline(JSON.stringify([{ status: 'completed', conclusion: 'failure', workflowName: 'CI' }]))).toEqual({ state: 'failed', detail: 'CI' })
  expect(githubPipeline('[]')).toBeNull()
})

test('pipeline text', () => {
  expect(pipeline({ state: 'running', detail: 'test' })).toBe('pipe ⏳ test')
  expect(pipeline({ state: 'passed', detail: '' })).toBe('pipe ✓')
  expect(pipeline({ state: 'failed', detail: 'lint unit' })).toBe('pipe ✗ lint unit')
  expect(pipeline({ state: 'no-login', detail: 'gitlab.example.org' })).toBe('pipe no login (gitlab.example.org)')
})
