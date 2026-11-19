export type Icon = { name: string; nerd: string; emoji: string; slot: string }

export const ICONS: Icon[]
export const DEFAULT_ICON: Icon
export function iconByName(name: string | undefined): Icon | null
export function iconFor(seedKey: string, options?: { picks?: Record<string, string>; rolls?: Record<string, number> }): Icon
export function iconToken(icon: Icon, state?: string, options?: { set?: string; frame?: number | null }): string
