// Shared plumbing for the herdr side: calling herdr, the user's tamagoxtix
// config, the active palette, and which monster belongs to which pane.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ICONS, iconFor, iconToken } from "./lib/icons.mjs";
import { makeMonster } from "./lib/monsters.mjs";
import { OMARCHY_COLORS_PATH, resolvePalette } from "./lib/palettes.mjs";
import { configDir, stateDir } from "./lib/usage-node.mjs";

export const SOURCE = "tamagoxtix";
export const TOKEN = "monster";

export function herdr(args) {
  const bin = process.env.HERDR_BIN_PATH ?? "herdr";
  const res = spawnSync(bin, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (res.status !== 0 && process.env.TAMAGOXTIX_DEBUG) {
    console.error(`herdr ${args.join(" ")} -> ${res.status}: ${res.stderr}`);
  }
  return res;
}

export function herdrJson(args) {
  const res = herdr(args);
  try {
    return JSON.parse(res.stdout)?.result ?? null;
  } catch {
    return null;
  }
}

// ---- config (shared with the Claude Code mod) ----

const configPath = () => join(configDir(), "config.json");

export function readConfig() {
  const defaults = { palette: "beach", icons: "nerd", sidebar: false };
  try {
    return { ...defaults, ...JSON.parse(readFileSync(configPath(), "utf8")) };
  } catch {
    return defaults;
  }
}

export function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(next, null, 2) + "\n");
  return next;
}

export function activePalette(config = readConfig()) {
  let omarchy = null;
  try {
    omarchy = readFileSync(join(homedir(), OMARCHY_COLORS_PATH), "utf8");
  } catch {}
  return resolvePalette(config.palette, omarchy);
}

// ---- monsters and icons ----

const rerollPath = () => join(stateDir(), "rerolls.json");
const picksPath = () => join(stateDir(), "icons.json");

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function writeJson(path, value) {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

// The seed is the agent's session when herdr knows it (the same Claude
// session keeps its monster across panes and restarts), else the pane.
export function seedKeyFor(pane) {
  return pane?.agent_session?.value ?? pane?.pane_id ?? "tamagoxtix";
}

export function iconForPane(pane) {
  return iconFor(seedKeyFor(pane), { picks: readJson(picksPath()), rolls: readJson(rerollPath()) });
}

// The pixel monster the stats popup draws, in its icon's color.
export function monsterFor(pane) {
  const key = seedKeyFor(pane);
  const rolls = readJson(rerollPath())[key] ?? 0;
  const monster = makeMonster(rolls ? `${key}#${rolls}` : key);
  return { ...monster, color: iconForPane(pane).slot };
}

export function reroll(pane) {
  const key = seedKeyFor(pane);
  const rolls = readJson(rerollPath());
  rolls[key] = (rolls[key] ?? 0) + 1;
  writeJson(rerollPath(), rolls);
  const picks = readJson(picksPath());
  delete picks[key];
  writeJson(picksPath(), picks);
}

// Live agents should not share an icon: walking the panes in a stable order,
// an agent whose icon is taken gets the next free one, saved as its pick so
// the Claude Code mod (which reads the same file) shows the same.
export function spreadIcons(panes) {
  const picks = readJson(picksPath());
  const rolls = readJson(rerollPath());
  const taken = new Set();
  let changed = false;
  const agents = panes.filter((p) => p.agent).sort((a, b) => a.pane_id.localeCompare(b.pane_id, "en", { numeric: true }));
  for (const pane of agents) {
    const key = seedKeyFor(pane);
    let icon = iconFor(key, { picks, rolls });
    if (taken.has(icon.name) && taken.size < ICONS.length) {
      const start = ICONS.indexOf(icon);
      for (let i = 1; i < ICONS.length; i++) {
        const next = ICONS[(start + i) % ICONS.length];
        if (!taken.has(next.name)) {
          icon = next;
          break;
        }
      }
      picks[key] = icon.name;
      changed = true;
    }
    taken.add(icon.name);
  }
  if (changed) writeJson(picksPath(), picks);
}

export function pickIcon(pane, name) {
  const picks = readJson(picksPath());
  picks[seedKeyFor(pane)] = name;
  writeJson(picksPath(), picks);
}

// herdr's agent_status values: idle, working, blocked, done, unknown.
export function stateOf(pane) {
  return pane?.agent_status ?? "unknown";
}

const URGENCY = { blocked: 4, working: 3, done: 2, idle: 1, unknown: 0 };

// ---- painting tokens ----

export function paintPane(pane) {
  if (!pane?.agent) {
    herdr(["pane", "report-metadata", pane.pane_id, "--source", SOURCE, "--clear-token", TOKEN]);
    return null;
  }
  const face = iconToken(iconForPane(pane), stateOf(pane), { set: readConfig().icons });
  herdr(["pane", "report-metadata", pane.pane_id, "--source", SOURCE, "--token", `${TOKEN}=${face}`]);
  return face;
}

// A Space shows the monster of its most urgent agent.
export function paintWorkspace(workspaceId, panes) {
  const agents = panes.filter((p) => p.workspace_id === workspaceId && p.agent);
  if (!agents.length) {
    herdr(["workspace", "report-metadata", workspaceId, "--source", SOURCE, "--clear-token", TOKEN]);
    return null;
  }
  const top = agents.reduce((a, b) => (URGENCY[stateOf(b)] > URGENCY[stateOf(a)] ? b : a));
  const face = iconToken(iconForPane(top), stateOf(top), { set: readConfig().icons });
  herdr(["workspace", "report-metadata", workspaceId, "--source", SOURCE, "--token", `${TOKEN}=${face}`]);
  return face;
}

export function listPanes() {
  return herdrJson(["pane", "list"])?.panes ?? [];
}

// Sidebar icons are opt-in (tamagoxtix.sidebar-install); while off, nothing
// is painted and herdr's own rows stay as they are.
export function sidebarEnabled() {
  return readConfig().sidebar === true;
}

export function paintAll() {
  if (!sidebarEnabled()) return [];
  const panes = listPanes();
  spreadIcons(panes);
  for (const pane of panes) paintPane(pane);
  for (const ws of new Set(panes.map((p) => p.workspace_id))) paintWorkspace(ws, panes);
  return panes;
}

export function readJsonEnv(name) {
  try {
    return JSON.parse(process.env[name] ?? "{}");
  } catch {
    return {};
  }
}
