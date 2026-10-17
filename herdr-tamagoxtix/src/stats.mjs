// Popup: token usage today, this 5-hour session and this week, as charts,
// drawn in the active palette. Keys: p palette, r refresh, q / esc close.
import { activePalette, herdrJson, monsterFor, readConfig, readJsonEnv } from "./common.mjs";
import { summarize } from "./lib/usage-node.mjs";
import { hexToRgb, mix, paletteChoices } from "./lib/palettes.mjs";
import { slotColor, spriteRuns } from "./lib/monsters.mjs";
import { applyPalette } from "./palette.mjs";
import { t } from "./i18n.mjs";

const out = process.stdout;
let palette = activePalette();
let data = null;
let frame = 0;
let message = "";
// The monster of the pane the popup was opened from.
const context = readJsonEnv("HERDR_PLUGIN_CONTEXT_JSON");
const paneId = context.focused_pane_id ?? context.pane_id ?? process.env.HERDR_PANE_ID;
const monster = monsterFor(paneId ? herdrJson(["pane", "get", paneId])?.pane : null);

// ---- ansi ----

const fg = (hex) => `\x1b[38;2;${hexToRgb(hex).join(";")}m`;
const bg = (hex) => `\x1b[48;2;${hexToRgb(hex).join(";")}m`;
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const paint = (hex, text, extra = "") => `${extra}${fg(hex)}${text}${RESET}`;

export function fmt(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
  return String(Math.round(n));
}

const visibleLength = (s) => s.replace(/\x1b\[[0-9;]*m/g, "").length;
const padRight = (s, w) => s + " ".repeat(Math.max(0, w - visibleLength(s)));

// the same meter as the Claude Code spinner and band: ▰ filled, ▱ empty
function bar(fraction, width, fill, empty) {
  const filled = Math.round(Math.max(0, Math.min(1, fraction)) * width);
  return paint(fill, "▰".repeat(filled)) + paint(empty, "▱".repeat(width - filled));
}

// Vertical bars, one column group per value, `height` rows of eighth-blocks.
function columns(values, height, colWidth, color, highlightLast) {
  const max = Math.max(1, ...values);
  const levels = " ▁▂▃▄▅▆▇█";
  const rows = [];
  for (let r = height - 1; r >= 0; r--) {
    let line = "";
    values.forEach((v, i) => {
      const cells = (v / max) * height;
      const level = Math.max(0, Math.min(8, Math.round((cells - r) * 8)));
      const ch = levels[level].repeat(colWidth);
      const c = highlightLast && i === values.length - 1 ? palette.accent : color;
      line += paint(c, ch) + " ";
    });
    rows.push(line);
  }
  return rows;
}

function resetIn(iso) {
  if (!iso) return "";
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h ? `${h}h ${m}m` : `${m}m`;
}

// ---- drawing ----

function sprite() {
  const mode = frame % 40 < 30 ? "idle" : "done";
  return spriteRuns(monster, mode, frame).map((runs) =>
    runs
      .map((r) => {
        const f = r.fg ? fg(slotColor(monster, r.fg, palette)) : "";
        const b = r.bg ? bg(slotColor(monster, r.bg, palette)) : "";
        return `${f}${b}${r.text}${RESET}`;
      })
      .join(""),
  );
}

function limitLine(label, limit, width) {
  if (!limit) return `${paint(palette.fg, label.padEnd(10))}${paint(palette.muted, t("noReading"))}`;
  const pct = limit.percentUsed ?? 0;
  const color = pct >= 90 ? palette.red : pct >= 70 ? palette.orange : palette.green;
  const reset = resetIn(limit.resetsAt);
  return (
    paint(palette.fg, label.padEnd(10)) +
    bar(pct / 100, width, color, mix(palette.bg, palette.fg, 0.2)) +
    paint(color, ` ${String(Math.round(pct)).padStart(3)}%`, BOLD) +
    (reset ? paint(palette.muted, `  ${t("resetsIn")} ${reset}`) : "")
  );
}

function draw() {
  const cols = out.columns || 80;
  const rows = out.rows || 24;
  const w = Math.max(40, cols - 4);
  const lines = [];
  const title = `${paint(palette.accent, "tamagoxtix", BOLD)}${paint(palette.muted, ` · ${t("usage")}`)}`;
  const keys = paint(palette.muted, `${t("palette")}: `) + paint(palette.magenta, palette.label) + paint(palette.muted, "   [p] [r] [q]");
  lines.push(padRight(title, w - visibleLength(keys)) + keys);
  lines.push("");

  if (!data) {
    lines.push(paint(palette.muted, t("loading")));
  } else {
    const limits = data.limits?.windows ?? [];
    const five = limits.find((l) => l.kind === "five_hour");
    const seven = limits.find((l) => l.kind === "seven_day");
    const spr = sprite();
    const barWidth = 16;
    const side = [
      `${paint(palette.fg, t("today").padEnd(10))}${paint(palette.yellow, fmt(data.today.tokens), BOLD)} ${paint(palette.muted, `tokens · ${fmt(data.today.output)} out`)}`,
      `${paint(palette.fg, t("session").padEnd(10))}${paint(palette.cyan, fmt(data.session?.tokens ?? 0), BOLD)} ${paint(palette.muted, "tokens")}`,
      `${paint(palette.fg, t("week").padEnd(10))}${paint(palette.magenta, fmt(data.week.tokens), BOLD)} ${paint(palette.muted, "tokens")}`,
    ];
    for (let i = 0; i < 3; i++) lines.push(`  ${spr[i] ?? ""}  ${side[i]}`);
    lines.push("");
    lines.push(`  ${limitLine(t("session5h"), five, barWidth)}`);
    lines.push(`  ${limitLine(t("weekly"), seven, barWidth)}`);
    if (!five && !seven) lines.push(paint(palette.muted, `  ${t("limitsHint")}`));
    lines.push("");

    // last 14 days
    const days = data.days;
    const colWidth = Math.max(1, Math.min(4, Math.floor((w - 2) / days.length) - 1));
    lines.push(`  ${paint(palette.fg, t("lastDays"), BOLD)} ${paint(palette.muted, `· max ${fmt(Math.max(...days.map((d) => d.tokens)))}`)}`);
    for (const row of columns(days.map((d) => d.tokens), 6, colWidth, palette.blue, true)) lines.push(`  ${row}`);
    lines.push(
      "  " +
        days
          .map((d) => paint(palette.muted, d.date.slice(8).padEnd(colWidth + 1).slice(0, colWidth + 1)))
          .join(""),
    );
    lines.push("");

    // today by hour
    const hours = data.today.hours;
    const hw = Math.max(1, Math.min(2, Math.floor((w - 2) / 24) - 1));
    lines.push(`  ${paint(palette.fg, t("todayByHour"), BOLD)}`);
    for (const row of columns(hours.map((h) => h.tokens), 4, hw, palette.green, false)) lines.push(`  ${row}`);
    lines.push(
      "  " +
        hours
          .map((h) => paint(palette.muted, (h.hour % 6 === 0 ? String(h.hour) : "").padEnd(hw + 1)))
          .join(""),
    );
  }
  if (message) lines.push("", paint(palette.yellow, `  ${message}`));

  const body = lines.slice(0, rows - 1).map((l) => `\x1b[2K ${l}`);
  out.write(`\x1b[H${body.join("\n")}\x1b[J`);
}

function load() {
  try {
    data = summarize({ days: 14 });
  } catch (error) {
    message = String(error.message ?? error);
  }
  draw();
}

// ---- palette switching ----

function cyclePalette() {
  const choices = paletteChoices();
  const current = readConfig().palette ?? "omarchy";
  const next = choices[(choices.indexOf(current) + 1) % choices.length];
  palette = applyPalette(next);
  message = `${t("palette")}: ${palette.label}`;
  draw();
}

// ---- main ----

function quit() {
  out.write("\x1b[?25h\x1b[?1049l");
  process.exit(0);
}

out.write("\x1b[?1049h\x1b[?25l\x1b[H\x1b[2J");
process.stdin.setRawMode?.(true);
process.stdin.resume();
process.stdin.on("data", (buf) => {
  const key = buf.toString();
  if (key === "q" || key === "\x1b" || key === "\x03") quit();
  else if (key === "p") cyclePalette();
  else if (key === "r") {
    message = "";
    load();
  }
});
out.on("resize", draw);
process.on("SIGTERM", quit);

draw();
setTimeout(load, 10);
setInterval(load, 15_000);
setInterval(() => {
  frame++;
  draw();
}, 250);
