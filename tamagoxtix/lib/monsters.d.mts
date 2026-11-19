import type { TamaMonster } from '../types'

export type Monster = Omit<TamaMonster, 'icon'>
export type SpriteRun = { text: string; fg?: string; bg?: string }

export function makeMonster(seedKey: string): Monster
export function spriteRuns(monster: Monster, mode: string, frame: number): SpriteRun[][]
export function slotColor(monster: Pick<Monster, 'color' | 'accent'>, slot: string, palette: Readonly<Record<string, string>>): string
