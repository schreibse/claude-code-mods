import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Board, Task } from '../types'
import { backgroundIdOf, bar, duration, fit, isShown, kindText, labelWidth, memText, memTone, monitorProgress, pairForeground, parsePs, progressOf, progressText, toolShells, treeOrder, treeRssKb } from './rules'

const board = atom({ plugin: 'task-meter', key: 'board' } as const, { tasks: [], now: 0 } as Board)

const TICK_MS = 2_000
const OUTPUT_TAIL_BYTES = '8192'
// A background shell's process can take a moment to appear; past this it is taken as finished.
const UNSEEN_GRACE_MS = 10_000
const RUNNING_AGENT = new Set(['pending', 'running', 'waiting'])

type Patch = Partial<Task>
type Sample = { patches: Map<string, Patch>; gone: Set<string>; now: number }

const addTask = ($: EngineInterface, task: Task) => update($, board, b => ({ ...b, tasks: [...b.tasks.filter(t => t.key !== task.key), task] }))
const dropTasks = ($: EngineInterface, isGone: (task: Task) => boolean) => update($, board, b => ({ ...b, tasks: b.tasks.filter(t => !isGone(t)) }))

async function stdoutLinks($: EngineInterface, pids: readonly number[]): Promise<Map<number, string>> {
  if (pids.length === 0) {
    return new Map()
  }
  const run = await $.process.run(['sh', '-c', 'for p; do printf "%s %s\\n" "$p" "$(readlink /proc/$p/fd/1)"; done', 'sh', ...pids.map(String)])
  return new Map(run.stdout.split('\n').flatMap(line => {
    const [pid, ...link] = line.split(' ')
    return pid ? [[Number(pid), link.join(' ')] as const] : []
  }))
}

async function tail($: EngineInterface, file: string): Promise<string> {
  const run = await $.process.run(['tail', '-c', OUTPUT_TAIL_BYTES, file]).catch(() => null)
  return run?.exitCode === 0 ? run.stdout : ''
}

async function sample($: EngineInterface, tasks: readonly Task[], claudePid: number, seen: Set<string>): Promise<Sample> {
  const now = await $.clock.now()
  const patches = new Map<string, Patch>()
  const gone = new Set<string>()
  const patch = (key: string, p: Patch) => patches.set(key, { ...patches.get(key), ...p })

  const rows = parsePs((await $.process.run(['ps', '-ww', '-eo', 'pid=,ppid=,rss=,args='])).stdout)
  const shells = toolShells(rows, claudePid)
  const links = await stdoutLinks($, shells.map(s => s.pid))
  const backgroundPids = new Map<string, { pid: number; file: string }>()
  for (const shell of shells) {
    const link = links.get(shell.pid) ?? ''
    const id = backgroundIdOf(link)
    if (id !== null) {
      backgroundPids.set(id, { pid: shell.pid, file: link.trim() })
    }
  }
  // Foreground shells write to a task output file too; only the ids of known background tasks tell them apart.
  const backgroundIds = new Set(tasks.flatMap(t => (t.kind === 'shell' && t.isBackground && t.taskId ? [t.taskId] : [])))
  const foregroundShells = shells.filter(s => !backgroundIds.has(backgroundIdOf(links.get(s.pid) ?? '') ?? ''))

  const foreground = tasks.filter(t => t.kind === 'shell' && !t.isBackground)
  const pairs = pairForeground(foreground, foregroundShells)
  for (const task of foreground) {
    const pid = pairs.get(task.key)
    patch(task.key, { memKb: pid === undefined ? undefined : treeRssKb(rows, pid) })
  }

  for (const task of tasks.filter(t => t.kind === 'shell' && t.isBackground)) {
    const found = task.taskId === undefined ? undefined : backgroundPids.get(task.taskId)
    if (found === undefined) {
      if (seen.has(task.key) || now - task.startedAt > UNSEEN_GRACE_MS) {
        gone.add(task.key)
      }
      continue
    }
    seen.add(task.key)
    patch(task.key, { memKb: treeRssKb(rows, found.pid), progress: progressOf(await tail($, found.file)), outputFile: found.file })
  }

  const agents = tasks.some(t => t.kind === 'agent') ? await $.agent.list().catch(() => []) : []
  const claimed = new Set(tasks.flatMap(t => (t.kind === 'agent' && t.taskId ? [t.taskId] : [])))
  for (const task of tasks.filter(t => t.kind === 'agent')) {
    let id = task.taskId
    if (id === undefined) {
      id = agents.find(a => !claimed.has(a.id) && RUNNING_AGENT.has(a.status) && a.description === task.label.replace(/^[^:]*: /, ''))?.id
      if (id !== undefined) {
        claimed.add(id)
        patch(task.key, { taskId: id })
      }
    }
    const status = agents.find(a => a.id === id)?.status
    if (task.isBackground && status !== undefined && !RUNNING_AGENT.has(status)) {
      gone.add(task.key)
      continue
    }
    const shellMem = foreground.filter(t => t.agentId !== undefined && t.agentId === id).reduce((sum, t) => sum + (patches.get(t.key)?.memKb ?? 0), 0)
    patch(task.key, { memKb: shellMem })
  }

  for (const task of tasks.filter(t => t.kind === 'monitor')) {
    if (task.timeoutMs && now - task.startedAt > task.timeoutMs + UNSEEN_GRACE_MS) {
      gone.add(task.key)
    } else {
      patch(task.key, { progress: monitorProgress(task, now) })
    }
  }
  return { patches, gone, now }
}

const resultOf = (result: unknown) => ((result as { result?: unknown } | undefined)?.result ?? {}) as Record<string, unknown>
const text = (value: unknown) => (typeof value === 'string' ? value : undefined)

type Poll = { claudePid: number; isBusy: boolean; seen: Set<string> }

async function tick($: EngineInterface, poll: Poll) {
  const { tasks } = await read($, board)
  if (poll.isBusy || tasks.length === 0) {
    return
  }
  poll.isBusy = true
  try {
    const { patches, gone, now } = await sample($, tasks, poll.claudePid, poll.seen)
    await update($, board, b => ({
      now,
      tasks: b.tasks.filter(t => !gone.has(t.key)).map(t => ({ ...t, ...patches.get(t.key) })),
    }))
  } finally {
    poll.isBusy = false
  }
}

function startTick($: EngineInterface, poll: Poll): void {
  void tick($, poll).catch((error: unknown) => $.ui.log(`task-meter: ${String(error)}`, { to: 'debug' }))
}

export const register: Register = on => {
  let timer: Timer | null = null

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const probe = await $.process.run(['sh', '-c', 'echo $PPID']).catch(() => null)
    const claudePid = Number(probe?.stdout.trim() ?? 0)
    await update($, board, () => ({ tasks: [], now: 0 }))
    timer?.cancel()
    timer = null
    if (claudePid > 0) {
      const current: Poll = { claudePid, isBusy: false, seen: new Set() }
      timer = $.clock.every(TICK_MS, () => startTick($, current))
    }
    return result
  })

  on('tool.call', async ($, e, next) => {
    const startedAt = await $.clock.now()
    const key = e.tool_use_id ?? `${e.tool}-${startedAt}-${Math.random()}`
    if (e.agentId !== undefined) {
      await update($, board, b => ({ ...b, tasks: b.tasks.map(t => (t.kind === 'agent' && t.taskId === e.agentId ? { ...t, tools: (t.tools ?? 0) + 1 } : t)) }))
    }

    if (e.tool === 'Bash' && !e.run_in_background) {
      await addTask($, { key, kind: 'shell', label: e.description ?? e.command, startedAt, isBackground: false, command: e.command, agentId: e.agentId })
      try {
        const result = await next(e)
        const id = text(resultOf(result).backgroundTaskId)
        await (id === undefined ? dropTasks($, t => t.key === key) : update($, board, b => ({ ...b, tasks: b.tasks.map(t => (t.key === key ? { ...t, isBackground: true, taskId: id } : t)) })))
        return result
      } catch (error) {
        await dropTasks($, t => t.key === key)
        throw error
      }
    }

    if (e.tool === 'Agent' && !(e as { run_in_background?: boolean }).run_in_background) {
      await addTask($, { key, kind: 'agent', label: `${e.subagent_type ?? 'agent'}: ${e.description}`, startedAt, isBackground: false })
      try {
        const result = await next(e)
        const r = resultOf(result)
        await (r.status === 'async_launched' ? update($, board, b => ({ ...b, tasks: b.tasks.map(t => (t.key === key ? { ...t, isBackground: true, taskId: text(r.agentId) } : t)) })) : dropTasks($, t => t.key === key))
        return result
      } catch (error) {
        await dropTasks($, t => t.key === key)
        throw error
      }
    }

    const result = await next(e)
    const r = resultOf(result)
    if (e.tool === 'Bash' && text(r.backgroundTaskId)) {
      await addTask($, { key, kind: 'shell', label: e.description ?? e.command, startedAt, isBackground: true, command: e.command, taskId: text(r.backgroundTaskId) })
    } else if (e.tool === 'Agent' && r.status === 'async_launched') {
      await addTask($, { key, kind: 'agent', label: `${e.subagent_type ?? 'agent'}: ${e.description}`, startedAt, isBackground: true, taskId: text(r.agentId), outputFile: text(r.outputFile) })
    } else if (e.tool === 'Workflow' && text(r.taskId)) {
      await addTask($, { key, kind: 'workflow', label: text(r.workflowName) ?? e.name ?? 'workflow', startedAt, isBackground: true, taskId: text(r.taskId) })
    } else if (e.tool === 'Monitor' && text(r.taskId)) {
      const timeoutMs = r.persistent === true ? undefined : Number(r.timeoutMs ?? e.timeout_ms) || undefined
      await addTask($, { key, kind: 'monitor', label: e.description, startedAt, isBackground: true, taskId: text(r.taskId), timeoutMs })
    } else if (e.tool === 'TaskStop') {
      const id = e.task_id ?? e.shell_id
      await dropTasks($, t => t.taskId === id)
    }
    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'UserMessage', props: { origin: { kind: 'task-notification' } } }, async ($, e, next) => {
    const id = e.props.task?.id
    if (id !== undefined && (await read($, board)).tasks.some(t => t.taskId === id)) {
      await dropTasks($, t => t.taskId === id)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const band = await next(e)
    const { tasks, now } = await read($, board)
    const shown = tasks.filter(t => isShown(t, now))
    if (shown.length === 0 || e.props.hasSurvey) {
      return band
    }
    const { Box, Text } = $.ui.resolve(e)
    const width = labelWidth((e.props as { bodyColumns?: number }).bodyColumns ?? 100)
    return (
      <Box flexDirection="column">
        {band}
        <Box flexDirection="column" paddingX={1}>
          {treeOrder(shown).map(({ task, isChild }) => (
            <Box key={task.key}>
              {isChild ? <Text dimColor>{'  └ '.padEnd(8)}</Text> : <Text color="cyan">{task.isBackground ? '↻ ' : '⏵ '}</Text>}
              {isChild ? null : <Text dimColor>{`${kindText(task)} `}</Text>}
              <Text>{`${fit(task.label, width)} `}</Text>
              <Text color={task.progress ? 'cyan' : undefined} dimColor={!task.progress}>{bar(task.progress, now)}</Text>
              <Text dimColor>{`  ${progressText(task).padStart(8)}`}</Text>
              <Text color={memTone(task.memKb)} dimColor={!memTone(task.memKb)}>{`  ${memText(task.memKb).padStart(5)}`}</Text>
              <Text dimColor>{`  ${duration(now - task.startedAt).padStart(5)}`}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    )
  })
}
