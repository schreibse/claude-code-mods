import type { TamaPalette } from '../types'

export const OMARCHY_COLORS_PATH: string
export function resolvePalette(choice?: string, omarchyColorsText?: string): Record<string, string> & { id: string }
export function paletteChoices(): string[]
export function claudeTheme(palette: TamaPalette, name?: string): Record<string, unknown>
