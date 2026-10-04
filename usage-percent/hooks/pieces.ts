import type { Piece, Tone } from '../types'

export function toneOf(percent: number, warn = 80, alarm = 95): Tone {
  return percent >= alarm ? 'red' : percent >= warn ? 'yellow' : 'dim'
}

export function dim(text: string): Piece {
  return { text, tone: 'dim' }
}

export function joined(groups: readonly Piece[][], gap: string): Piece[] {
  return groups.filter(group => group.length > 0).flatMap((group, i) => (i === 0 ? group : [dim(gap), ...group]))
}
