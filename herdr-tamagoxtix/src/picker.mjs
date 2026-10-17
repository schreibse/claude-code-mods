// Popup: choose the focused agent's icon. Arrows or j/k move, enter picks,
// r rolls a random one, s switches between Nerd Font and emoji icons, q closes.
import { activePalette, herdrJson, iconForPane, listPanes, paintPane, paintWorkspace, pickIcon, readConfig, readJsonEnv, reroll, writeConfig } from "./common.mjs";
import { ICONS } from "./lib/icons.mjs";
import { hexToRgb } from "./lib/palettes.mjs";
import { refresh as refreshSidebar } from "./sidebar.mjs";

const out = process.stdout;
const context = readJsonEnv("HERDR_PLUGIN_CONTEXT_JSON");
const paneId = context.focused_pane_id ?? context.pane_id ?? process.env.HERDR_PANE_ID;
const pane = paneId ? herdrJson(["pane", "get", paneId])?.pane : null;
const palette = activePalette();
let set = readConfig().icons ?? "nerd";
let cursor = Math.max(0, ICONS.findIndex((i) => i.name === iconForPane(pane).name));

const fg = (hex) => `\x1b[38;2;${hexToRgb(hex).join(";")}m`;
const bg = (hex) => `\x1b[48;2;${hexToRgb(hex).join(";")}m`;
const RESET = "\x1b[0m";

function draw() {
  const lines = [];
  lines.push(`${fg(palette.accent)}\x1b[1m tamagoxtix\x1b[22m${fg(palette.muted)} · ${pane?.agent ? `icon for ${pane.agent} in ${pane.pane_id}` : "focus an agent pane first"}${RESET}`);
  lines.push("");
  ICONS.forEach((icon, i) => {
    const glyph = set === "emoji" ? icon.emoji : icon.nerd;
    const selected = i === cursor;
    const row = ` ${fg(palette[icon.slot])}${glyph}${RESET}  ${selected ? fg(palette.fg) + "\x1b[1m" : fg(palette.muted)}${icon.name}${RESET}`;
    lines.push(selected ? `${bg(palette.muted)}${row.replaceAll(RESET, RESET + bg(palette.muted))}\x1b[K${RESET}` : row);
  });
  lines.push("");
  lines.push(`${fg(palette.muted)} ↑↓ move · enter pick · r random · s ${set === "nerd" ? "emoji" : "nerd font"} icons · q close${RESET}`);
  out.write(`\x1b[H${lines.map((l) => `\x1b[2K${l}`).join("\n")}\x1b[J`);
}

function repaint() {
  if (!pane?.agent) return;
  paintPane(pane);
  paintWorkspace(pane.workspace_id, listPanes());
}

function quit() {
  out.write("\x1b[?25h\x1b[?1049l");
  process.exit(0);
}

out.write("\x1b[?1049h\x1b[?25l\x1b[2J");
process.stdin.setRawMode?.(true);
process.stdin.resume();
process.stdin.on("data", (buf) => {
  const key = buf.toString();
  if (key === "q" || key === "\x1b" || key === "\x03") quit();
  else if (key === "\x1b[A" || key === "k") cursor = (cursor + ICONS.length - 1) % ICONS.length;
  else if (key === "\x1b[B" || key === "j") cursor = (cursor + 1) % ICONS.length;
  else if (key === "\r" && pane?.agent) {
    pickIcon(pane, ICONS[cursor].name);
    repaint();
    quit();
  } else if (key === "r" && pane?.agent) {
    reroll(pane);
    repaint();
    cursor = Math.max(0, ICONS.findIndex((i) => i.name === iconForPane(pane).name));
  } else if (key === "s") {
    set = set === "nerd" ? "emoji" : "nerd";
    writeConfig({ icons: set });
    refreshSidebar();
    for (const p of listPanes()) paintPane(p);
  }
  draw();
});
out.on("resize", draw);
draw();
