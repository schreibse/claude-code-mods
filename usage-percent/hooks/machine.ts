const GIB = 1024 ** 3

export function memory(current: number, max: number, pressureAvg10: number): string {
  const used = Number.isFinite(max) ? `mem ${(current / GIB).toFixed(1)}/${Math.round(max / GIB)}G` : `mem ${(current / GIB).toFixed(1)}G`
  if (pressureAvg10 <= 0) {
    return used
  }
  return `${used} psi ${Math.round(pressureAvg10)}%${pressureAvg10 >= 50 ? '▲' : ''}`
}

export function pressureAvg10(pressureFile: string): number {
  return Number(/^some avg10=([\d.]+)/m.exec(pressureFile)?.[1] ?? 0)
}

export function servedProjects(psArgs: string): string[] {
  const names = [...psArgs.matchAll(/\bnx (?:serve ([\w.-]+)|run ([\w.-]+):serve\b)/g)].map(m => m[1] ?? m[2] ?? '')
  return [...new Set(names.filter(Boolean))].sort()
}
