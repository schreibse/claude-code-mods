// Puts the monsters in herdr's sidebar: a marked block in config.toml with
// Agent and Space rows that show $monster, colored from the active palette.
//   node sidebar.mjs install | uninstall | refresh | print
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { basename, dirname, join } from "node:path";
import { activePalette, herdr, paintAll, readConfig, TOKEN, writeConfig } from "./common.mjs";
import { ICONS, STATE_MARKERS } from "./lib/icons.mjs";

const BEGIN = "# >>> tamagoxtix sidebar (managed by the tamagoxtix plugin) >>>";
const END = "# <<< tamagoxtix sidebar <<<";

export function herdrConfigPath() {
  const socket = process.env.HERDR_SOCKET_PATH;
  if (socket && !socket.startsWith("\\\\")) {
    // The socket lives in the config dir, or in sessions/<name>/ under it.
    let dir = dirname(socket);
    if (basename(dirname(dir)) === "sessions") dir = dirname(dirname(dir));
    return join(dir, "config.toml");
  }
  if (process.platform === "win32" && process.env.APPDATA) return join(process.env.APPDATA, "herdr", "config.toml");
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(base, "herdr", "config.toml");
}

// First match wins: the state markers, then each icon in its own color.
function rules(palette, set) {
  const marks = STATE_MARKERS[set] ?? STATE_MARKERS.nerd;
  const list = [
    `{ contains = ${JSON.stringify(marks.blocked)}, fg = "${palette.red}", bold = true }`,
    `{ contains = ${JSON.stringify(marks.done)}, fg = "${palette.green}" }`,
    ...ICONS.map((icon) => `{ starts_with = ${JSON.stringify(icon[set] ?? icon.nerd)}, fg = "${palette[icon.slot]}" }`),
  ];
  return `rules = [${list.join(", ")}]`;
}

export function block(palette = activePalette(), set = readConfig().icons) {
  const monster = (bold) => `{ token = "$${TOKEN}", bold = ${bold}, ${rules(palette, set)} }`;
  return [
    BEGIN,
    `# palette: ${palette.id} · icons: ${set}`,
    "[ui.sidebar.agents]",
    "rows = [",
    `  [${monster(true)}, "workspace", "tab"],`,
    `  ["agent"],`,
    "]",
    "",
    "[ui.sidebar.spaces]",
    "rows = [",
    `  [${monster(true)}, "workspace"],`,
    `  ["branch", "git_status"],`,
    "]",
    END,
  ].join("\n");
}

function stripBlock(text) {
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start < 0 || end < start) return { text, found: false };
  const before = text.slice(0, start).replace(/\n+$/, "\n");
  const after = text.slice(end + END.length).replace(/^\n+/, "");
  return { text: before + (after ? "\n" + after : ""), found: true };
}

// Tables we would define; a config that already defines them outside our
// block would make herdr reject the file.
function conflicts(text) {
  return ["[ui.sidebar.agents]", "[ui.sidebar.spaces]", "[ui.sidebar]"].filter((t) => text.includes(t));
}

export function install() {
  const path = herdrConfigPath();
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  const { text: base, found } = stripBlock(current);
  const clash = conflicts(base);
  if (clash.length) {
    return {
      ok: false,
      message: `${path} already defines ${clash.join(", ")}. Add the $${TOKEN} token to those rows yourself, or remove them and run install again. Snippet:\n\n${block()}`,
    };
  }
  if (current && !found) copyFileSync(path, `${path}.tamagoxtix-backup`);
  const next = `${base.replace(/\n*$/, "\n")}\n${block()}\n`;
  writeFileSync(path, next);
  const check = herdr(["config", "check"]);
  if (check.status !== 0) {
    writeFileSync(path, current);
    return { ok: false, message: `herdr rejected the change, config restored:\n${check.stdout}${check.stderr}` };
  }
  herdr(["server", "reload-config"]);
  writeConfig({ sidebar: true });
  paintAll();
  return { ok: true, message: `Monsters added to the sidebar (${path}).` };
}

export function uninstall() {
  const path = herdrConfigPath();
  if (!existsSync(path)) return { ok: true, message: "Nothing to remove." };
  const { text, found } = stripBlock(readFileSync(path, "utf8"));
  if (!found) return { ok: true, message: "The sidebar block is not installed." };
  writeFileSync(path, text);
  herdr(["server", "reload-config"]);
  writeConfig({ sidebar: false });
  return { ok: true, message: "Sidebar restored to herdr's own rows." };
}

// Rewrites the block's colors after a palette change, only when installed.
export function refresh() {
  const path = herdrConfigPath();
  if (!existsSync(path) || !readFileSync(path, "utf8").includes(BEGIN)) return { ok: true, message: "" };
  return install();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cmd = process.argv[2] ?? "install";
  const result =
    cmd === "uninstall" ? uninstall() : cmd === "refresh" ? refresh() : cmd === "print" ? { ok: true, message: block() } : install();
  const out = result.message;
  if (out) (result.ok ? console.log : console.error)(out);
  if (cmd !== "print" && out && readConfig()) {
    herdr(["notification", "show", "TamaGoxtix", "--body", out.split("\n")[0]]);
  }
  process.exit(result.ok ? 0 : 1);
}
