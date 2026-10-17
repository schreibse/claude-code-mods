// A herdr look: a status area right of the tabs with icons and powerline
// separators, colored by herdr's own theme by default, or (follow-palette)
// herdr's colors and sidebar rows painted in the tamagoxtix palette. herdr has no background colors for these, so the
// arrows are drawn as separators rather than filled segments.
//   node theme.mjs install | uninstall | refresh | print
//
// config.toml keeps one table per name, so the keys go into the existing
// [ui] and [theme.custom] tables between markers; keys of the person's that
// would clash are commented out and come back on uninstall.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { activePalette, herdr, readConfig, writeConfig } from "./common.mjs";
import { mix } from "./lib/palettes.mjs";
import { stateDir } from "./lib/usage-node.mjs";
import { herdrConfigPath } from "./sidebar.mjs";

const BEGIN = "# >>> tamagoxtix theme >>>";
const END = "# <<< tamagoxtix theme <<<";
const DISABLED = "# tamagoxtix-disabled: ";
const SIDEBAR_MARK = "# >>> tamagoxtix sidebar";

// ---- what goes in ----

const toml = (value) => JSON.stringify(value);

export function themeKeys(p) {
  return {
    "theme.custom": {
      accent: p.accent,
      panel_bg: p.bg,
      sidebar_bg: mix(p.bg, p.fg, 0.03),
      active_row_bg: mix(p.bg, p.accent, 0.22),
      selection_bg: mix(p.bg, p.accent, 0.35),
      surface0: mix(p.bg, p.fg, 0.1),
      surface1: mix(p.bg, p.fg, 0.18),
      surface_dim: mix(p.bg, p.fg, 0.05),
      overlay0: p.muted,
      overlay1: mix(p.fg, p.bg, 0.45),
      text: p.fg,
      subtext0: mix(p.fg, p.bg, 0.25),
      mauve: p.magenta,
      green: p.green,
      yellow: p.yellow,
      red: p.red,
      blue: p.blue,
      teal: p.cyan,
      peach: p.orange,
    },
  };
}

// Nerd Font icons and arrows, or plain symbols (/tamagoxtix icons plain)
const nerdIcons = () => (readConfig().icons ?? "nerd") === "nerd";
const separator = () => toml(nerdIcons() ? "  \ue0b1  " : "  │  ");

function statusEntries() {
  const script = join(stateDir(), "herdr-bar", "status-bar.mjs");
  const run = (segment, interval) =>
    `{ type = "command", command = ${toml(`node "${script}" ${segment}`)}, interval_seconds = ${interval}, timeout_seconds = 3 }`;
  const clock = nerdIcons() ? '{ type = "datetime", format = "\\uf017 %H:%M" }' : '{ type = "datetime", format = "%H:%M" }';
  return `[${[run("git", 5), run("tokens", 60), run("limits", 30), '{ type = "zoom" }', clock].join(", ")}]`;
}

// herdr's default sidebar rows, colored from the palette, Spaces in orange.
function sidebarTables(p) {
  return [
    "[ui.sidebar.spaces]",
    `rows = [["state_icon", { token = "workspace", fg = ${toml(p.orange)}, bold = true }], [{ token = "branch", fg = ${toml(p.magenta)} }, "git_status"]]`,
    "",
    "[ui.sidebar.agents]",
    `rows = [["state_icon", { token = "workspace", fg = ${toml(p.blue)} }, { token = "tab", fg = ${toml(p.muted)} }], [{ token = "agent", fg = ${toml(p.accent)}, bold = true }, { token = "state_text", fg = ${toml(p.muted)} }]]`,
  ];
}

// ---- config.toml editing ----

const isHeader = (line) => /^\s*\[[^\]]+\]\s*(#.*)?$/.test(line);
const headerName = (line) => line.trim().replace(/^\[|\]\s*(#.*)?$/g, "").trim();

// The lines of a key's value: one, or until a multi-line array or table closes.
function valueSpan(lines, i) {
  let depth = 0;
  let j = i;
  do {
    for (const ch of lines[j].replace(/"(?:[^"\\]|\\.)*"/g, "")) {
      if (ch === "[" || ch === "{") depth++;
      else if (ch === "]" || ch === "}") depth--;
    }
    j++;
  } while (depth > 0 && j < lines.length);
  return j - i;
}

export function strip(text) {
  const out = [];
  let inside = false;
  for (const line of text.split("\n")) {
    if (line.trim() === BEGIN) inside = true;
    else if (line.trim() === END) inside = false;
    else if (!inside) out.push(line.startsWith(DISABLED) ? line.slice(DISABLED.length) : line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

// Puts `keys` (name -> TOML value text) into table `table`, creating it at
// the end when missing; clashing keys of the person's are commented out.
function upsertTable(lines, table, keys) {
  let start = lines.findIndex((l) => isHeader(l) && headerName(l) === table);
  const block = [BEGIN, ...Object.entries(keys).map(([k, v]) => `${k} = ${v}`), END];
  if (start < 0) {
    lines.push("", BEGIN, `[${table}]`, ...block.slice(1, -1), END);
    return;
  }
  let end = lines.findIndex((l, i) => i > start && isHeader(l));
  if (end < 0) end = lines.length;
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(/^\s*([A-Za-z0-9_-]+)\s*=/);
    if (m && m[1] in keys) {
      const span = valueSpan(lines, i);
      for (let j = i; j < i + span; j++) lines[j] = DISABLED + lines[j];
      i += span - 1;
    }
  }
  lines.splice(start + 1, 0, ...block);
}

// `colors`: "herdr" leaves every color to herdr's own theme (switch it in
// herdr and everything follows); "palette" paints herdr in the tamagoxtix
// palette, Spaces in its orange.
export function apply(text, p, { sidebar = true, colors = "herdr" } = {}) {
  const lines = strip(text).replace(/\n*$/, "").split("\n");
  if (colors !== "palette") {
    upsertTable(lines, "ui", { tab_bar_right: statusEntries(), tab_bar_right_separator: separator() });
    return lines.join("\n") + "\n";
  }
  for (const [table, values] of Object.entries(themeKeys(p))) {
    upsertTable(lines, table, Object.fromEntries(Object.entries(values).map(([k, v]) => [k, toml(v)])));
  }
  upsertTable(lines, "ui", { accent: toml(p.accent), tab_bar_right: statusEntries(), tab_bar_right_separator: separator() });
  const hasOwnSidebar = lines.some((l) => /^\s*\[ui\.sidebar(\.|\])/.test(l)) || text.includes(SIDEBAR_MARK);
  if (sidebar && !hasOwnSidebar) lines.push("", BEGIN, ...sidebarTables(p), END);
  return lines.join("\n") + "\n";
}

// ---- Omarchy: refresh the palette when its theme changes ----

const OMARCHY_HOOK = join(homedir(), ".config", "omarchy", "hooks", "theme-set.d", "tamagoxtix");
const HOOK_SCRIPT = `#!/bin/bash
# Installed by the tamagoxtix herdr plugin: follow the new Omarchy theme.
command -v herdr >/dev/null && herdr plugin action invoke tamagoxtix.palette-refresh >/dev/null 2>&1 || true
`;

function omarchyHook(on) {
  try {
    if (on && existsSync(dirname(dirname(OMARCHY_HOOK)))) {
      mkdirSync(dirname(OMARCHY_HOOK), { recursive: true });
      writeFileSync(OMARCHY_HOOK, HOOK_SCRIPT, { mode: 0o755 });
    } else if (!on && existsSync(OMARCHY_HOOK)) {
      rmSync(OMARCHY_HOOK);
    }
  } catch {}
}

// ---- actions ----

function copyStatusBar() {
  const here = dirname(fileURLToPath(import.meta.url));
  const dest = join(stateDir(), "herdr-bar");
  mkdirSync(join(dest, "lib"), { recursive: true });
  copyFileSync(join(here, "status-bar.mjs"), join(dest, "status-bar.mjs"));
  for (const file of ["usage-node.mjs", "forge.mjs"]) copyFileSync(join(here, "lib", file), join(dest, "lib", file));
}

function write(next, previous) {
  const path = herdrConfigPath();
  writeFileSync(path, next);
  const check = herdr(["config", "check"]);
  if (check.status !== 0 || !String(check.stdout).includes("ok")) {
    writeFileSync(path, previous);
    return { ok: false, message: `herdr rejected the change, config restored:\n${check.stdout}${check.stderr}` };
  }
  herdr(["server", "reload-config"]);
  return { ok: true };
}

export function install() {
  const path = herdrConfigPath();
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (current && !current.includes(BEGIN)) copyFileSync(path, `${path}.tamagoxtix-theme-backup`);
  copyStatusBar();
  const colors = readConfig().herdrColors === "palette" ? "palette" : "herdr";
  const result = write(apply(current, activePalette(), { colors }), current);
  if (!result.ok) return result;
  writeConfig({ herdrTheme: true });
  omarchyHook(colors === "palette" && readConfig().palette === "omarchy");
  const how = colors === "palette" ? `colors from the ${activePalette().label} palette` : "colors from herdr's theme";
  return { ok: true, message: `tamagoxtix look on, ${how}. tamagoxtix.theme-uninstall restores yours.` };
}

export function uninstall() {
  const path = herdrConfigPath();
  if (!existsSync(path)) return { ok: true, message: "Nothing to remove." };
  const current = readFileSync(path, "utf8");
  if (!current.includes(BEGIN) && !current.includes(DISABLED)) return { ok: true, message: "The tamagoxtix look is not installed." };
  const result = write(strip(current).replace(/\n*$/, "\n"), current);
  if (!result.ok) return result;
  writeConfig({ herdrTheme: false });
  omarchyHook(false);
  return { ok: true, message: "herdr's own look is back." };
}

// Where the look takes its colors from: "herdr" or "palette".
export function follow(colors) {
  writeConfig({ herdrColors: colors });
  return install();
}

// After a palette change: recolor, only when installed.
export function refresh() {
  if (readConfig().herdrTheme !== true) return { ok: true, message: "" };
  return install();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cmd = process.argv[2] ?? "install";
  const result =
    cmd === "uninstall"
      ? uninstall()
      : cmd === "refresh"
        ? refresh()
        : cmd === "follow-herdr"
          ? follow("herdr")
          : cmd === "follow-palette"
            ? follow("palette")
            : cmd === "print"
              ? { ok: true, message: apply("", activePalette(), { colors: readConfig().herdrColors }) }
              : install();
  if (result.message) (result.ok ? console.log : console.error)(result.message);
  if (cmd !== "print" && result.message) herdr(["notification", "show", "TamaGoxtix", "--body", result.message.split("\n")[0]]);
  process.exit(result.ok ? 0 : 1);
}
