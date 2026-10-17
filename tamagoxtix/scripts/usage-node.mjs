// GENERATED from shared/usage-node.mjs by scripts/sync-shared.mjs. Edit the original.
// Token usage from Claude Code's local transcripts (~/.claude/projects/**.jsonl),
// summed per hour and day, plus the rate-limit readings the Claude Code mod
// saves (5-hour session and weekly windows).
//
// Node only. Run as a script it prints the summary as JSON:
//   node usage-node.mjs [--days 14]
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DAY = 86_400_000;
const CACHE_VERSION = 3;

export function claudeDir() {
  return process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
}

export function stateDir() {
  const base = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");
  return join(base, "tamagoxtix");
}

export function configDir() {
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(base, "tamagoxtix");
}

// TamaGoxtix was called tamaclaude before 2.0: carry its config and state
// over once, the first time the new folders are looked for.
export function migrateLegacy() {
  const config = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  const state = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");
  for (const base of [config, state]) {
    const from = join(base, "tamaclaude");
    const to = join(base, "tamagoxtix");
    try {
      if (existsSync(from) && !existsSync(to)) cpSync(from, to, { recursive: true });
    } catch {}
  }
}
migrateLegacy();

function* jsonlFiles(dir, since) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* jsonlFiles(path, since);
    else if (entry.name.endsWith(".jsonl")) {
      try {
        const st = statSync(path);
        if (st.mtimeMs >= since) yield { path, mtimeMs: st.mtimeMs, size: st.size };
      } catch {}
    }
  }
}

// A short stand-in for a response's message and request ids (FNV-1a, 52
// bits, base 36): enough to count each response once, a fraction of the size.
function shortKey(text) {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) h = BigInt.asUintN(64, (h ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n);
  return (h >> 12n).toString(36);
}

// One compact row per API response at or after `since`:
// [key, epochMs, input, output, cacheWrite, cacheRead]
function readFileRows(path, since) {
  const rows = [];
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return rows;
  }
  for (const line of text.split("\n")) {
    if (!line.includes('"usage"')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const usage = entry?.message?.usage;
    if (entry?.type !== "assistant" || !usage) continue;
    const at = Date.parse(entry.timestamp);
    if (!Number.isFinite(at) || at < since) continue;
    const key = shortKey(`${entry.message.id ?? ""}:${entry.requestId ?? ""}`);
    rows.push([
      key,
      at,
      usage.input_tokens ?? 0,
      usage.output_tokens ?? 0,
      usage.cache_creation_input_tokens ?? 0,
      usage.cache_read_input_tokens ?? 0,
    ]);
  }
  return rows;
}

function loadCache() {
  try {
    const cache = JSON.parse(readFileSync(join(stateDir(), "usage-cache.json"), "utf8"));
    if (cache.version === CACHE_VERSION) return cache;
  } catch {}
  return { version: CACHE_VERSION, files: {} };
}

function saveCache(cache) {
  try {
    mkdirSync(stateDir(), { recursive: true });
    writeFileSync(join(stateDir(), "usage-cache.json"), JSON.stringify(cache));
  } catch {}
}

export function readLimits() {
  try {
    return JSON.parse(readFileSync(join(stateDir(), "limits.json"), "utf8"));
  } catch {
    return null;
  }
}

const localDay = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const startOfLocalDay = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// Claude's 5-hour session windows open with the first request after the
// previous window closed; the current one is found by walking the history.
function currentBlock(rows, now) {
  let start = null;
  for (const row of rows) {
    const at = row[1];
    if (start === null || at >= start + 5 * 3_600_000) start = Math.floor(at / 3_600_000) * 3_600_000;
  }
  if (start === null || now >= start + 5 * 3_600_000) return null;
  return { start, end: start + 5 * 3_600_000 };
}

export function summarize({ days = 14, now = Date.now() } = {}) {
  const since = startOfLocalDay(now) - (days - 1) * DAY;
  const cache = loadCache();
  const seen = new Set();
  const live = {};
  const rows = [];

  for (const file of jsonlFiles(join(claudeDir(), "projects"), since)) {
    // the cache keeps only rows inside the window it was read for: a file read
    // for a shorter window is read again for a longer one
    let cached = cache.files[file.path];
    if (!cached || cached.mtimeMs !== file.mtimeMs || cached.size !== file.size || cached.since > since) {
      cached = { mtimeMs: file.mtimeMs, size: file.size, since, rows: readFileRows(file.path, since) };
    } else if (cached.since < since) {
      cached = { ...cached, since, rows: cached.rows.filter((row) => row[1] >= since) };
    }
    live[file.path] = cached;
    for (const row of cached.rows) {
      if (row[1] < since || seen.has(row[0])) continue;
      seen.add(row[0]);
      rows.push(row);
    }
  }
  cache.files = live;
  saveCache(cache);
  rows.sort((a, b) => a[1] - b[1]);

  const empty = () => ({ tokens: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, requests: 0 });
  const add = (sum, row) => {
    sum.input += row[2];
    sum.output += row[3];
    sum.cacheWrite += row[4];
    sum.cacheRead += row[5];
    sum.tokens += row[2] + row[3] + row[4] + row[5];
    sum.requests += 1;
  };

  const byDay = new Map();
  for (let i = 0; i < days; i++) byDay.set(localDay(since + i * DAY + DAY / 2), empty());
  const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, ...empty() }));
  const today = localDay(now);
  const weekStart = startOfLocalDay(now) - 6 * DAY;
  const week = empty();
  const block = currentBlock(rows, now);
  const session = empty();

  for (const row of rows) {
    const day = localDay(row[1]);
    if (byDay.has(day)) add(byDay.get(day), row);
    if (day === today) add(hours[new Date(row[1]).getHours()], row);
    if (row[1] >= weekStart) add(week, row);
    if (block && row[1] >= block.start) add(session, row);
  }

  return {
    generatedAt: now,
    days: [...byDay].map(([date, sum]) => ({ date, ...sum })),
    today: { date: today, ...(byDay.get(today) ?? empty()), hours },
    session: block ? { ...block, ...session } : null,
    week: { start: weekStart, ...week },
    limits: readLimits(),
  };
}

export function writeLimits(limits) {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(join(stateDir(), "limits.json"), JSON.stringify(limits, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const i = process.argv.indexOf("--days");
  const days = i > 0 ? Number(process.argv[i + 1]) || 14 : 14;
  process.stdout.write(JSON.stringify(summarize({ days })) + "\n");
}

