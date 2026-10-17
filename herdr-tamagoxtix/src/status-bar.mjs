// One entry of herdr's tab-bar status area (ui.tab_bar_right), printed as one
// line. herdr runs it in the active pane's folder and strips colors, so the
// look comes from Nerd Font icons and the powerline separator between entries.
//   node status-bar.mjs git | limits | tokens
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { configDir, stateDir, summarize } from "./lib/usage-node.mjs";
import { clean } from "./lib/forge.mjs";
import { join } from "node:path";

// Nerd Font icons, or plain symbols (/tamagoxtix icons plain)
const NERD = { branch: "\uf418", gauge: "\u{f029a}", week: "\u{f0a33}", tokens: "\u{f01bc}" };
const PLAIN = { branch: "⎇", gauge: "◑", week: "▦", tokens: "$" };
let iconSet = "nerd";
try {
  iconSet = JSON.parse(readFileSync(join(configDir(), "config.json"), "utf8")).icons ?? "nerd";
} catch {}
const ICON = iconSet === "nerd" ? NERD : PLAIN;

function git(args) {
  const res = spawnSync("git", args, { encoding: "utf8", timeout: 1500 });
  return res.status === 0 ? res.stdout.trim() : null;
}

function fmt(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
  return String(Math.round(n));
}

const segment = process.argv[2];
let line = "";

if (segment === "git") {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch) {
    const counts = git(["rev-list", "--left-right", "--count", "@{u}...HEAD"]) ?? "";
    const [behind = 0, ahead = 0] = counts.split(/\s+/).map(Number);
    const dirty = (git(["status", "--porcelain"]) ?? "").split("\n").filter(Boolean).length;
    line = `${ICON.branch} ${clean(branch, 32)}${ahead ? ` ↑${ahead}` : ""}${behind ? ` ↓${behind}` : ""}${dirty ? ` ●${dirty}` : ""}`;
  }
} else if (segment === "limits") {
  try {
    const { windows = [] } = JSON.parse(readFileSync(join(stateDir(), "limits.json"), "utf8"));
    const pct = (kind) => windows.find((w) => w.kind === kind)?.percentUsed;
    const five = pct("five_hour");
    const week = pct("seven_day");
    line = [five !== undefined && `${ICON.gauge} 5h ${Math.round(five)}%`, week !== undefined && `${ICON.week} wk ${Math.round(week)}%`].filter(Boolean).join("  ");
  } catch {}
} else if (segment === "tokens") {
  try {
    line = `${ICON.tokens} ${fmt(summarize({ days: 1 }).today.tokens)} today`;
  } catch {}
}

if (line) process.stdout.write(line + "\n");
