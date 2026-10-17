// Claude Code status line in the oh-my-posh style: model, folder, git branch,
// context, the 5-hour and weekly limits and the session's time, as powerline
// segments in the tamagoxtix palette.
//
// Claude Code runs it with the session's data as JSON on stdin
// (statusLine.command); /tamagoxtix statusline on sets that up.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import { clean } from "./forge.mjs";
import { OMARCHY_COLORS_PATH, resolvePalette } from "./palettes.mjs";
import { GLYPH as NERD, levelColor, PLAIN, powerline } from "./powerline.mjs";

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

function config() {
  const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  try {
    return JSON.parse(readFileSync(join(configHome, "tamagoxtix", "config.json"), "utf8"));
  } catch {
    return {};
  }
}

function palette() {
  const choice = config().palette ?? "beach";
  let omarchy;
  try {
    omarchy = readFileSync(join(homedir(), OMARCHY_COLORS_PATH), "utf8");
  } catch {}
  return resolvePalette(choice, omarchy);
}

function git(cwd, args) {
  const res = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", timeout: 1500 });
  return res.status === 0 ? res.stdout.trim() : null;
}

function duration(ms) {
  const m = Math.floor(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m}m`;
}

const input = readStdin();
const p = palette();
// plain symbols when there is no Nerd Font (/tamagoxtix icons plain)
const plain = (config().icons ?? "nerd") !== "nerd";
const GLYPH = plain ? PLAIN : NERD;
const cwd = input.workspace?.current_dir ?? input.cwd ?? process.cwd();
const segments = [];

// the model leads in orange, the highlight of every palette
segments.push({ text: `${GLYPH.model} ${clean(input.model?.display_name ?? "Claude", 24)}`, color: p.orange, bold: true });
segments.push({ text: `${GLYPH.folder} ${clean(basename(cwd), 32)}`, color: p.accent });

const branch = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch) {
  const counts = git(cwd, ["rev-list", "--left-right", "--count", "@{u}...HEAD"]);
  const [behind = 0, ahead = 0] = (counts ?? "").split(/\s+/).map(Number);
  const dirty = (git(cwd, ["status", "--porcelain"]) ?? "").split("\n").filter(Boolean).length;
  const marks = `${ahead ? ` ↑${ahead}` : ""}${behind ? ` ↓${behind}` : ""}${dirty ? ` ●${dirty}` : ""}`;
  segments.push({ text: `${GLYPH.branch} ${clean(branch, 32)}${marks}`, color: dirty ? p.yellow : p.magenta });
}

const ctx = input.context_window?.used_percentage;
if (typeof ctx === "number") segments.push({ text: `${GLYPH.context} ${Math.round(ctx)}%`, color: levelColor(ctx, p, p.cyan) });

const five = input.rate_limits?.five_hour?.used_percentage;
if (typeof five === "number") segments.push({ text: `${GLYPH.gauge} 5h ${Math.round(five)}%`, color: levelColor(five, p) });
const week = input.rate_limits?.seven_day?.used_percentage;
if (typeof week === "number") segments.push({ text: `${GLYPH.week} wk ${Math.round(week)}%`, color: levelColor(week, p, p.teal ?? p.cyan) });

const ms = input.cost?.total_duration_ms;
if (typeof ms === "number") segments.push({ text: `${GLYPH.clock} ${duration(ms)}`, color: p.muted });

process.stdout.write(powerline(segments, p, { plain }) + "\n");
