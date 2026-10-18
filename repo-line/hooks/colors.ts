const FIRST_HUE = 200
const GOLDEN_ANGLE = 137.5

/** The hue of the n-th repository seen (0-based): golden-angle steps keep any number of them apart. */
export function hueAt(index: number): number {
  return (FIRST_HUE + index * GOLDEN_ANGLE) % 360
}

/** HSL at a fixed saturation and lightness that reads on dark and light terminals. */
export function hexOf(hue: number, s = 0.65, l = 0.6): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x]
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')
}

/** `#rrggbb` as is, a hue 0–359 through hexOf; anything else null. */
export function parseColor(text: string): string | null {
  const trimmed = text.trim()
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toLowerCase()
  }
  const hue = Number(trimmed)
  return trimmed !== '' && Number.isInteger(hue) && hue >= 0 && hue < 360 ? hexOf(hue) : null
}

// Repository name and worktree from `git rev-parse --git-common-dir --show-toplevel`; the branch, or the short
// HEAD when detached.
export function repoFacts(commonDir: string, toplevel: string, branch: string, shortHead: string): { name: string; worktree: string | null; branch: string } {
  const main = commonDir.replace(/\/\.git\/?$/, '')
  const name = main.split('/').filter(Boolean).pop() ?? ''
  const worktreeName = toplevel.split('/').filter(Boolean).pop() ?? ''
  return { name, worktree: toplevel !== '' && toplevel !== main ? worktreeName : null, branch: branch !== '' ? branch : `@${shortHead}` }
}
