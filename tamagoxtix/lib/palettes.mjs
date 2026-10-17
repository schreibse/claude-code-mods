// GENERATED from shared/palettes.mjs by scripts/sync-shared.mjs. Edit the original.
// TamaGoxtix palettes: the color slots every drawing uses, a set of built-in
// palettes after Omarchy's themes, and a reader for Omarchy's colors.toml so
// "omarchy" follows whatever theme is active.
//
// Pure module (no Node or engine APIs) shared by the herdr plugin and the
// Claude Code mod.

export const SLOTS = ["bg", "fg", "muted", "accent", "red", "orange", "yellow", "green", "cyan", "blue", "magenta"];

export const PALETTES = {
  // tamagoxtix's own: Omarchy's Beach theme, ocean dusk with terracotta,
  // palm green, seafoam and bougainvillea
  beach: {
    label: "Beach",
    mode: "dark",
    bg: "#0d1f2b", fg: "#dfd8c8", muted: "#3d5b6e", accent: "#3f96d4",
    red: "#e35d5b", orange: "#e8813f", yellow: "#f2c14e", green: "#7fbf6a",
    cyan: "#5fd3c4", blue: "#4fa6e0", magenta: "#e84f9a",
  },
  "tokyo-night": {
    label: "Tokyo Night",
    mode: "dark",
    bg: "#1a1b26", fg: "#a9b1d6", muted: "#414868", accent: "#7aa2f7",
    red: "#f7768e", orange: "#eb927b", yellow: "#e0af68", green: "#9ece6a",
    cyan: "#449dab", blue: "#7aa2f7", magenta: "#ad8ee6",
  },
  catppuccin: {
    label: "Catppuccin",
    mode: "dark",
    bg: "#1e1e2e", fg: "#cdd6f4", muted: "#585b70", accent: "#89b4fa",
    red: "#f38ba8", orange: "#fab387", yellow: "#f9e2af", green: "#a6e3a1",
    cyan: "#94e2d5", blue: "#89b4fa", magenta: "#f5c2e7",
  },
  gruvbox: {
    label: "Gruvbox",
    mode: "dark",
    bg: "#282828", fg: "#d4be98", muted: "#665c54", accent: "#7daea3",
    red: "#ea6962", orange: "#e1875c", yellow: "#d8a657", green: "#a9b665",
    cyan: "#89b482", blue: "#7daea3", magenta: "#d3869b",
  },
  nord: {
    label: "Nord",
    mode: "dark",
    bg: "#2e3440", fg: "#d8dee9", muted: "#4c566a", accent: "#81a1c1",
    red: "#bf616a", orange: "#d08770", yellow: "#ebcb8b", green: "#a3be8c",
    cyan: "#88c0d0", blue: "#81a1c1", magenta: "#b48ead",
  },
  everforest: {
    label: "Everforest",
    mode: "dark",
    bg: "#2d353b", fg: "#d3c6aa", muted: "#475258", accent: "#7fbbb3",
    red: "#e67e80", orange: "#e69875", yellow: "#dbbc7f", green: "#a7c080",
    cyan: "#83c092", blue: "#7fbbb3", magenta: "#d699b6",
  },
  kanagawa: {
    label: "Kanagawa",
    mode: "dark",
    bg: "#1f1f28", fg: "#dcd7ba", muted: "#54546d", accent: "#7e9cd8",
    red: "#e46876", orange: "#ffa066", yellow: "#e6c384", green: "#98bb6c",
    cyan: "#7fb4ca", blue: "#7e9cd8", magenta: "#957fb8",
  },
  "rose-pine": {
    label: "Rosé Pine",
    mode: "dark",
    bg: "#191724", fg: "#e0def4", muted: "#6e6a86", accent: "#c4a7e7",
    red: "#eb6f92", orange: "#f6c177", yellow: "#f6c177", green: "#31748f",
    cyan: "#9ccfd8", blue: "#31748f", magenta: "#c4a7e7",
  },
  "osaka-jade": {
    label: "Osaka Jade",
    mode: "dark",
    bg: "#111c18", fg: "#c1c497", muted: "#53685b", accent: "#509475",
    red: "#ff5345", orange: "#e5c736", yellow: "#e5c736", green: "#549e6a",
    cyan: "#2dd5b7", blue: "#509475", magenta: "#d2689c",
  },
  ristretto: {
    label: "Ristretto",
    mode: "dark",
    bg: "#2c2525", fg: "#e6d9db", muted: "#72696a", accent: "#f38d70",
    red: "#fd6883", orange: "#fb9a77", yellow: "#f9cc6c", green: "#adda78",
    cyan: "#85dacc", blue: "#a8a9eb", magenta: "#a8a9eb",
  },
  "matte-black": {
    label: "Matte Black",
    mode: "dark",
    bg: "#121212", fg: "#bebebe", muted: "#333333", accent: "#e68e0d",
    red: "#d35f5f", orange: "#e68e0d", yellow: "#ffc107", green: "#8a9a5b",
    cyan: "#8fb8c8", blue: "#6f8fbf", magenta: "#b07ab0",
  },
};

export const DEFAULT_PALETTE = "beach";

// The orange used where a theme has none.
export const HIGHLIGHT_ORANGE = "#e8875b";

// ---- Omarchy ----

// Omarchy themes ship colors.toml in one of two shapes: named slots
// (`accent`, `red`, ...) or terminal slots (`color0`..`color15`).
export function parseColorsToml(text) {
  const raw = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*"(#[0-9A-Fa-f]{6})"/);
    if (m) raw[m[1]] = m[2].toLowerCase();
  }
  const mode = /^\s*mode\s*=\s*"light"/m.test(text) ? "light" : "dark";
  const c = (n) => raw[`color${n}`];
  const palette = {
    label: "Omarchy",
    mode,
    bg: raw.background ?? c(0),
    fg: raw.foreground ?? c(7) ?? c(15),
    muted: raw.muted ?? raw.dark_foreground ?? c(8),
    accent: raw.accent ?? c(4),
    red: raw.red ?? c(1),
    // a theme without its own orange still gets one, for highlights
    orange: raw.orange ?? HIGHLIGHT_ORANGE,
    yellow: raw.yellow ?? c(3) ?? c(11),
    green: raw.green ?? c(2),
    cyan: raw.cyan ?? c(6),
    blue: raw.blue ?? c(4),
    magenta: raw.magenta ?? c(5),
  };
  // Any slot the file left out falls back to the default palette's.
  for (const slot of SLOTS) palette[slot] ??= PALETTES[DEFAULT_PALETTE][slot];
  return palette;
}

// Where the active Omarchy theme lives, relative to the home directory.
export const OMARCHY_COLORS_PATH = ".local/state/omarchy/current/theme/colors.toml";
export const OMARCHY_NAME_PATH = ".local/state/omarchy/current/theme.name";

// Picks the palette named by `choice` ("omarchy", a built-in id). The caller
// hands in the Omarchy colors.toml text when it could read one.
export function resolvePalette(choice, omarchyColorsText) {
  if (choice === "omarchy" || !choice) {
    if (omarchyColorsText) return { id: "omarchy", ...parseColorsToml(omarchyColorsText) };
    return { id: DEFAULT_PALETTE, ...PALETTES[DEFAULT_PALETTE] };
  }
  const palette = PALETTES[choice] ?? PALETTES[DEFAULT_PALETTE];
  return { id: PALETTES[choice] ? choice : DEFAULT_PALETTE, ...palette };
}

export function paletteChoices() {
  return ["omarchy", ...Object.keys(PALETTES)];
}

// ---- helpers ----

export function hexToRgb(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const to = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${to(r1, r2)}${to(g1, g2)}${to(b1, b2)}`;
}

// Claude Code custom theme (~/.claude/themes/<name>.json) colored from a
// palette, so the chat text itself follows it. The mapping is Omarchy's own
// (default/themed/claude.json.tpl), so every palette reads like an Omarchy
// theme does in Claude Code.
export function claudeTheme(palette, name = "TamaGoxtix") {
  const p = palette;
  const brightYellow = mix(p.yellow, p.fg, 0.3);
  const brightCyan = mix(p.cyan, p.fg, 0.3);
  return {
    name,
    base: p.mode === "light" ? "light" : "dark",
    overrides: {
      claude: p.accent,
      claudeShimmer: mix(p.accent, p.fg, 0.35),
      text: p.fg,
      inverseText: p.bg,
      inactive: mix(p.fg, p.bg, 0.4),
      inactiveShimmer: mix(p.fg, p.bg, 0.25),
      subtle: p.muted,
      suggestion: p.cyan,
      permission: p.blue,
      permissionShimmer: mix(p.blue, p.fg, 0.35),
      remember: p.yellow,
      success: p.green,
      error: p.red,
      warning: p.yellow,
      warningShimmer: mix(p.yellow, p.fg, 0.35),
      merged: p.magenta,
      promptBorder: p.accent,
      promptBorderShimmer: mix(p.accent, p.fg, 0.35),
      planMode: p.cyan,
      autoAccept: p.yellow,
      bashBorder: brightYellow,
      ide: brightCyan,
      diffAdded: mix(p.bg, p.green, 0.15),
      diffRemoved: mix(p.bg, p.red, 0.15),
      diffAddedDimmed: mix(p.bg, p.green, 0.08),
      diffRemovedDimmed: mix(p.bg, p.red, 0.08),
      diffAddedWord: mix(p.bg, p.green, 0.32),
      diffRemovedWord: mix(p.bg, p.red, 0.32),
      userMessageBackground: mix(p.bg, p.fg, 0.06),
      userMessageBackgroundHover: mix(p.bg, p.fg, 0.1),
      bashMessageBackgroundColor: mix(p.bg, p.fg, 0.06),
      memoryBackgroundColor: mix(p.bg, p.fg, 0.06),
      selectionBg: mix(p.bg, p.accent, 0.45),
      rate_limit_fill: p.accent,
      rate_limit_empty: mix(p.bg, p.fg, 0.2),
      briefLabelYou: p.yellow,
      briefLabelClaude: p.accent,
    },
  };
}
