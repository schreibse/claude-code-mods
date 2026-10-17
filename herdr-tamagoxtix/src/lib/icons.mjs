// GENERATED from shared/icons.mjs by scripts/sync-shared.mjs. Edit the original.
// Sidebar icons: one critter per agent, picked from a set by seed and
// changeable by the person (reroll, or pick one by name).
//
// The `nerd` set needs a Nerd Font (Omarchy ships JetBrainsMono Nerd Font);
// `emoji` works in any terminal with color emoji. Both sets list the same
// names in the same order, so a pick survives switching sets.
//
// Pure module shared by the herdr plugin and the Claude Code mod.

import { hashString } from "./monsters.mjs";

/** @typedef {{ name: string, nerd: string, emoji: string, slot: string }} Icon */

// Each icon has a palette slot for its color. Red is left out: it means blocked.
/** @type {Icon[]} */
export const ICONS = [
  { name: "ghost", nerd: "\u{f02a0}", emoji: "👻", slot: "magenta" },
  { name: "invader", nerd: "\u{f0bc9}", emoji: "👾", slot: "green" },
  { name: "alien", nerd: "\u{f089a}", emoji: "👽", slot: "cyan" },
  { name: "robot", nerd: "\u{f1719}", emoji: "🤖", slot: "blue" },
  { name: "pacman", nerd: "\u{f0baf}", emoji: "🟡", slot: "yellow" },
  { name: "jellyfish", nerd: "\u{f0f01}", emoji: "🐙", slot: "accent" },
  { name: "cat", nerd: "\u{f011b}", emoji: "🐱", slot: "orange" },
  { name: "owl", nerd: "\u{f03d2}", emoji: "🦉", slot: "yellow" },
  { name: "penguin", nerd: "\u{f0ec0}", emoji: "🐧", slot: "blue" },
  { name: "ladybug", nerd: "\u{f082d}", emoji: "🐞", slot: "orange" },
  { name: "bat", nerd: "\u{f0b5f}", emoji: "🦇", slot: "magenta" },
  { name: "unicorn", nerd: "\u{f15c2}", emoji: "🦄", slot: "accent" },
  { name: "snail", nerd: "\u{f1677}", emoji: "🐌", slot: "green" },
];

/** @type {Icon} */
export const DEFAULT_ICON = /** @type {Icon} */ (ICONS[0]);

export const ICON_SETS = ["nerd", "emoji"];

// State markers follow the icon; the sidebar color rules match on them.
export const STATE_MARKERS = {
  nerd: { blocked: "\u{f0026}", done: "\u{f012c}", working: "\u{f01d8}" },
  emoji: { blocked: "❗", done: "✅", working: "…" },
};

// Braille spinner frames for an agent whose face is animated while it works.
export const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** @param {string | undefined} name @returns {Icon | null} */
export function iconByName(name) {
  return ICONS.find((icon) => icon.name === name) ?? null;
}

// `picks` maps a seed key to an icon name the person chose; `rolls` to how
// many times they rerolled it.
/**
 * @param {string} seedKey
 * @param {{ picks?: Record<string, string>, rolls?: Record<string, number> }} [options]
 * @returns {Icon}
 */
export function iconFor(seedKey, { picks = {}, rolls = {} } = {}) {
  const picked = iconByName(picks[seedKey]);
  if (picked) return picked;
  const n = rolls[seedKey] ?? 0;
  return /** @type {Icon} */ (ICONS[hashString(n ? `${seedKey}#${n}` : String(seedKey)) % ICONS.length]);
}

/**
 * The sidebar token: the icon, then what the agent is doing.
 * @param {Icon} icon
 * @param {string} [state]
 * @param {{ set?: string, frame?: number | null }} [options]
 */
export function iconToken(icon, state = "idle", { set = "nerd", frame = null } = {}) {
  const glyph = set === "emoji" ? icon.emoji : icon.nerd;
  const marks = set === "emoji" ? STATE_MARKERS.emoji : STATE_MARKERS.nerd;
  switch (state) {
    case "working":
      return `${glyph} ${frame === null ? marks.working : SPINNER[frame % SPINNER.length]}`;
    case "blocked":
      return `${glyph} ${marks.blocked}`;
    case "done":
      return `${glyph} ${marks.done}`;
    default:
      return glyph;
  }
}
