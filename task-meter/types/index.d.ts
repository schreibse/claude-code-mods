export type TaskKind = 'shell' | 'agent' | 'workflow' | 'monitor'
export type Progress = { done: number; total: number; unit: string } | { percent: number }

export type Task = {
  key: string
  kind: TaskKind
  label: string
  startedAt: number
  isBackground: boolean
  /** Bash command as the shell runs it, to find its process. */
  command?: string
  /** Owning subagent of a foreground shell. */
  agentId?: string
  /** Bash background id, Agent id, Workflow or Monitor task id. */
  taskId?: string
  outputFile?: string
  timeoutMs?: number
  memKb?: number
  progress?: Progress
  tools?: number
}

export type Board = { tasks: Task[]; now: number }

declare module 'claude-code' {
  interface PluginState {
    'task-meter': { board: Board }
  }
}
