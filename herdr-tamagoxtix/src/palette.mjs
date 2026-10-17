// Switching palettes: saves the choice, writes the matching Claude Code
// theme file and recolors the sidebar rules.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { activePalette, writeConfig } from "./common.mjs";
import { claudeTheme } from "./lib/palettes.mjs";
import { claudeDir } from "./lib/usage-node.mjs";
import { refresh as refreshSidebar } from "./sidebar.mjs";
import { refresh as refreshTheme } from "./theme.mjs";

export function applyPalette(choice) {
  const palette = activePalette(writeConfig({ palette: choice }));
  // Claude Code reloads ~/.claude/themes on change; the file is rewritten
  // only where the chat uses it (/tamagoxtix theme on).
  try {
    const settings = JSON.parse(readFileSync(join(claudeDir(), "settings.json"), "utf8"));
    if (settings.theme !== "custom:tamagoxtix") throw new Error("chat theme not in use");
    const dir = join(claudeDir(), "themes");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "tamagoxtix.json"), JSON.stringify(claudeTheme(palette), null, 2) + "\n");
  } catch {}
  refreshSidebar();
  refreshTheme();
  return palette;
}
