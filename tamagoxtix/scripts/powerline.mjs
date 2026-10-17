// GENERATED from shared/powerline.mjs by scripts/sync-shared.mjs. Edit the original.
// Powerline segments in the oh-my-posh style: text on a colored background,
// each joined to the next by an arrow in the previous segment's color.
//
// Pure module: used by the Claude Code status line. Needs a Nerd Font for the
// arrows and icons.

import { hexToRgb, mix } from "./palettes.mjs";

export const GLYPH = {
  arrow: "", //
  thin: "", //
  capLeft: "", //
  capRight: "", //
  model: "\u{f167a}", // 󱙺
  folder: "\u{f024b}", // 󰉋
  branch: "", //
  context: "\u{f09d1}", // 󰧑
  gauge: "\u{f029a}", // 󰊚
  week: "\u{f0a33}", // 󰨳
  clock: "\u{f0150}", // 󰅐
};

// The same segments without a Nerd Font: symbols every font draws, and the
// segments meet edge to edge instead of through an arrow.
export const PLAIN = {
  model: "◆",
  folder: "▸",
  branch: "⎇",
  context: "◔",
  gauge: "◑",
  week: "▦",
  clock: "◷",
};

const fg = (hex) => `\x1b[38;2;${hexToRgb(hex).join(";")}m`;
const bg = (hex) => `\x1b[48;2;${hexToRgb(hex).join(";")}m`;
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

/**
 * Joins segments into one powerline row. Each segment is { text, color }:
 * the background color; the text is drawn in the palette's background so it
 * reads on any segment color. `round` ends the row with rounded caps.
 * @param {{ text: string, color: string, bold?: boolean }[]} segments
 * @param {{ bg: string, fg: string }} palette
 * @param {{ round?: boolean }} [options]
 */
export function powerline(segments, palette, { round = true, plain = false } = {}) {
  const parts = segments.filter((s) => s && s.text);
  if (!parts.length) return "";
  const ink = mix(palette.bg, "#000000", 0.2);
  let out = round && !plain ? `${fg(parts[0].color)}${GLYPH.capLeft}` : "";
  parts.forEach((seg, i) => {
    out += `${bg(seg.color)}${fg(ink)}${seg.bold ? BOLD : ""} ${seg.text} ${RESET}`;
    if (plain) return;
    const next = parts[i + 1];
    if (next) out += `${bg(next.color)}${fg(seg.color)}${GLYPH.arrow}`;
    else out += `${fg(seg.color)}${round ? GLYPH.capRight : GLYPH.arrow}`;
  });
  return out + RESET;
}

/** The color a percentage reads in: calm, warning, alarm. */
export function levelColor(pct, palette, calm = palette.green) {
  return pct >= 90 ? palette.red : pct >= 70 ? palette.orange : calm;
}
