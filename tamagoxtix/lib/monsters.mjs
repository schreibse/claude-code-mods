// GENERATED from shared/monsters.mjs by scripts/sync-shared.mjs. Edit the original.
// TamaGoxtix monsters: small pixel critters in the spirit of Claude Code's
// mascot, generated from a seed so every agent gets its own.
//
// Pure module (no Node or engine APIs) shared by the herdr plugin and the
// Claude Code mod. Colors are palette slot names, resolved by palettes.mjs.

// ---- seeded randomness ----

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// ---- parts ----

// Bodies are 10 px wide and 5 px tall: '#' body, 'o' eye (a hole), 'a'
// accent. Eyes sit on rows 2-3 so they fill one whole text cell.
export const BODIES = [
  { id: "clawd", rows: [".########.", ".########.", ".#o####o#.", "##o####o##", ".########."] },
  { id: "blob", rows: ["...####...", ".########.", ".#o####o#.", ".#o####o#.", "..######.."] },
  { id: "horned", rows: ["a........a", ".a######a.", ".#o####o#.", ".#o####o#.", ".########."] },
  { id: "antenna", rows: ["....aa....", "...####...", ".#o####o#.", "##o####o##", ".########."] },
  { id: "kitty", rows: [".##....##.", ".########.", ".#o####o#.", ".#o####o#.", ".########."] },
  { id: "goggles", rows: ["..######..", ".########.", "##oo##oo##", ".#oo##oo#.", ".########."] },
  { id: "cyclops", rows: ["..######..", ".########.", ".###oo###.", "####oo####", ".########."] },
  { id: "bunny", rows: ["..a....a..", "..##..##..", ".#o####o#.", ".#o####o#.", ".########."] },
  // more critters: hats, horns, masks, shells, spikes
  { id: "slime", rows: ["...####...", ".########.", ".#o####o#.", "##o####o##", "##########"] },
  { id: "bear", rows: ["##......##", "##########", ".#o####o#.", ".#o#aa#o#.", ".########."] },
  { id: "frog", rows: [".oo....oo.", "#oo####oo#", "##########", "#aaaaaaaa#", ".########."] },
  { id: "owl", rows: ["#........#", "##########", "#oo####oo#", "#oo#aa#oo#", ".########."] },
  { id: "ghosty", rows: ["..######..", ".########.", ".#o####o#.", ".#o####o#.", "#.##.##.#."] },
  { id: "tv", rows: ["...a..a...", "##########", "#oo####oo#", "#oo####oo#", "##########"] },
  { id: "mushroom", rows: [".aaaaaaaa.", "aa#aaaa#aa", ".#o####o#.", ".#o####o#.", "..######.."] },
  { id: "claws", rows: ["a........a", "aa.####.aa", ".#o####o#.", "##o####o##", ".########."] },
  { id: "ninja", rows: ["..######..", "aaaaaaaaaa", "a#o####o#a", ".#o####o#.", ".########."] },
  { id: "viking", rows: ["a.######.a", "aa######aa", ".#o####o#.", ".#o####o#.", ".########."] },
  { id: "king", rows: ["a.a.aa.a.a", "aaaaaaaaaa", ".#o####o#.", ".#o####o#.", ".########."] },
  { id: "wizard", rows: ["....aa....", "...aaaa...", ".aaaaaaaa.", ".#o####o#.", ".#o####o#."] },
  { id: "bandit", rows: [".########.", "##########", "aaoaaaaoaa", "##o####o##", ".########."] },
  { id: "unicorn", rows: ["....aa....", "..######..", ".###oo###.", ".###oo###.", "..######.."] },
  { id: "tall", rows: ["...####...", "..######..", "..#o##o#..", "..#o##o#..", "..######.."] },
  { id: "chonk", rows: ["##########", "##########", "#o######o#", "#o######o#", "##########"] },
  { id: "batty", rows: ["a........a", "aa######aa", "a#o####o#a", ".#o####o#.", "..######.."] },
  { id: "bee", rows: [".########.", ".#o####o#.", ".#o####o#.", "aaaaaaaaaa", ".########."] },
  { id: "pumpkin", rows: ["....aa....", ".########.", "##o####o##", "#.o####o.#", ".########."] },
  { id: "lynx", rows: ["#........#", "##.####.##", "##########", "##o####o##", ".#o####o#."] },
  { id: "penguin", rows: ["..######..", ".##aaaa##.", ".#oaaaao#.", ".#oaaaao#.", "..######.."] },
  { id: "jelly", rows: ["..######..", ".########.", ".#o####o#.", ".#o####o#.", "#.#.#.#.#."] },
  { id: "cloud", rows: ["..##..##..", ".########.", "##o####o##", "##o####o##", ".##.##.##."] },
  { id: "rocket", rows: ["....##....", "...####...", "..#o##o#..", ".##o##o##.", "a########a"] },
  { id: "sushi", rows: ["aaaaaaaaaa", "a########a", "a#o####o#a", "a#o####o#a", "aaaaaaaaaa"] },
  { id: "dino", rows: ["..a.a.a...", ".########.", ".#o####o##", ".#o#######", ".######..."] },
  { id: "astronaut", rows: ["..aaaaaa..", ".a######a.", "a#o####o#a", "a#o####o#a", ".aaaaaaaa."] },
  { id: "donut", rows: [".aaaaaaaa.", "a########a", "##o####o##", "##o####o##", ".########."] },
  { id: "triclops", rows: ["..######..", ".########.", ".#o#oo#o#.", ".#o#oo#o#.", ".########."] },
  { id: "pug", rows: ["a########a", "a########a", ".#o#aa#o#.", ".#o####o#.", ".########."] },
];

// Legs are one px row, two frames each for walking.
export const LEGS = [
  { id: "crab", frames: [".#.#..#.#.", "#.#....#.#"] },
  { id: "stubby", frames: ["..#....#..", ".#......#."] },
  { id: "tentacle", frames: [".#.#.#.#..", "..#.#.#.#."] },
  { id: "boots", frames: [".##....##.", "##......##"] },
  { id: "wheels", frames: ["#.#....#.#", ".#......#."] },
  { id: "skirt", frames: ["#.#.#.#.#.", ".#.#.#.#.#"] },
  { id: "spring", frames: ["....##....", "...#..#..."] },
];

// Body colors, each tied to the bracket pair its one-line face uses so the
// herdr sidebar can tell the color from the text alone.
export const COLORS = [
  { slot: "orange", left: "▐", right: "▌" },
  { slot: "magenta", left: "ʕ", right: "ʔ" },
  { slot: "cyan", left: "(", right: ")" },
  { slot: "green", left: "{", right: "}" },
  { slot: "yellow", left: "[", right: "]" },
  { slot: "blue", left: "«", right: "»" },
  { slot: "accent", left: "▕", right: "▏" },
];

const FACE_EYES = ["°", "o", "•", "O", "0", "@", "e", "ö"];
const FACE_MOUTHS = ["w", "v", "_", "o", "3", "u", "x", "-"];
const ACCENTS = ["yellow", "red", "cyan", "magenta", "green", "fg"];

const SYLLABLES = ["blo", "rp", "zu", "mi", "ko", "ra", "pi", "nu", "gle", "bo", "ta", "fu", "zi", "mo", "ka", "li", "do", "wi"];

// ---- the monster ----

export function makeMonster(seedKey) {
  const seed = hashString(String(seedKey));
  const rand = rng(seed);
  const bodyIndex = Math.floor(rand() * BODIES.length);
  const legs = pick(rand, LEGS);
  const color = pick(rand, COLORS);
  const accent = pick(rand, ACCENTS.filter((a) => a !== color.slot));
  const syllables = 2 + Math.floor(rand() * 2);
  let name = "";
  for (let i = 0; i < syllables; i++) name += pick(rand, SYLLABLES);
  return {
    seed,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    body: BODIES[bodyIndex].id,
    legs: legs.id,
    color: color.slot,
    accent,
    face: {
      left: color.left,
      right: color.right,
      eye: FACE_EYES[bodyIndex % FACE_EYES.length],
      mouth: FACE_MOUTHS[Math.floor(rand() * FACE_MOUTHS.length)],
    },
  };
}

// ---- one-line face (herdr sidebar) ----

// Suffix glyphs double as markers the sidebar color rules match on.
export const FACE_MARKERS = { working: "~", blocked: "!", done: "✓", idle: "", unknown: "" };

export function faceFor(monster, state = "idle", frame = 0) {
  const { left, right, eye, mouth } = monster.face;
  switch (state) {
    case "working": {
      const mouths = [mouth, "o", mouth, "-"];
      const eyes = frame % 8 === 7 ? "-" : eye;
      return `${left}${eyes}${mouths[frame % mouths.length]}${eyes}${right}${FACE_MARKERS.working}`;
    }
    case "blocked":
      return `${left}>${mouth}<${right}${FACE_MARKERS.blocked}`;
    case "done":
      return `${left}^${mouth}^${right}${FACE_MARKERS.done}`;
    default:
      return `${left}-${mouth}-${right}`;
  }
}

// ---- pixel sprite (Claude Code spinner, stats) ----

// Animation modes follow Claude Code's turn modes plus herdr's agent states.
export const MODES = ["idle", "requesting", "thinking", "tool-input", "tool-use", "responding", "blocked", "done"];

// Returns a 6x12 grid of color slots (null = empty). The body sits in a
// 10 px box with one px of room each side for shakes and arms.
export function spriteGrid(monster, mode = "idle", frame = 0) {
  const W = 12;
  const H = 6;
  const grid = Array.from({ length: H }, () => Array(W).fill(null));
  const body = BODIES.find((b) => b.id === monster.body) ?? BODIES[0];
  const legs = LEGS.find((l) => l.id === monster.legs) ?? LEGS[0];

  let dx = 1; // body offset inside the 12 px box (shakes, steps)
  let squat = false; // body one px lower with legs tucked: the bounce frame
  let legFrame = 0;
  let eyes = "open"; // open | closed | happy | worried
  let look = 0;

  switch (mode) {
    case "idle":
      eyes = frame % 16 === 15 ? "closed" : "open";
      break;
    case "requesting":
      squat = frame % 4 >= 2;
      eyes = frame % 12 === 11 ? "closed" : "open";
      break;
    case "thinking":
      look = frame % 8 < 4 ? 1 : -1;
      eyes = frame % 10 === 9 ? "closed" : "open";
      break;
    case "tool-input":
    case "tool-use":
      legFrame = frame % 2;
      dx = 1 + (frame % 4 === 1 ? 1 : frame % 4 === 3 ? -1 : 0);
      break;
    case "responding":
      squat = frame % 2 === 1;
      legFrame = frame % 2;
      break;
    case "blocked":
      dx = 1 + (frame % 2 === 0 ? -1 : 1);
      eyes = "worried";
      break;
    case "done":
      squat = frame % 6 >= 4;
      eyes = "happy";
      break;
    // poses for the idle scenes
    case "sleep":
      squat = frame % 8 >= 4; // slow breathing
      eyes = "closed";
      break;
    case "chew":
      squat = frame % 2 === 1;
      eyes = "happy";
      break;
    case "walk":
      legFrame = frame % 2;
      break;
    case "read":
      look = 1;
      eyes = frame % 14 === 13 ? "closed" : "worried"; // eyes down on the page
      break;
    case "hop":
      squat = frame % 4 >= 2;
      eyes = "happy";
      legFrame = frame % 2;
      break;
  }

  const put = (y, x, value) => {
    if (y >= 0 && y < H && x >= 0 && x < W) grid[y][x] = value;
  };
  const top = squat ? 1 : 0;
  const holes = [];

  body.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "#" || ch === "o") put(top + y, dx + x, "body");
      else if (ch === "a") put(top + y, dx + x, "accent");
      if (ch === "o") holes.push({ y, x });
    });
  });
  // Eyes are cut after the body so a glance can move them over body pixels.
  const firstEyeRow = Math.min(...holes.map((h) => h.y));
  for (const { y, x } of holes) {
    const upper = y === firstEyeRow;
    const open =
      eyes === "open" || (eyes === "happy" && upper) || (eyes === "worried" && !upper);
    if (open) put(top + y, dx + x + look, null);
  }
  if (!squat) {
    [...legs.frames[legFrame]].forEach((ch, x) => {
      if (ch === "#") put(H - 1, dx + x, "body");
    });
  }
  return grid;
}

// Converts a grid of slots into rows of half-block cells: each text row packs
// two pixel rows (fg = top pixel, bg = bottom pixel).
export function gridToCells(grid) {
  const rows = [];
  for (let y = 0; y < grid.length; y += 2) {
    const top = grid[y];
    const bottom = grid[y + 1] ?? [];
    const cells = top.map((t, x) => {
      const b = bottom[x] ?? null;
      if (!t && !b) return { ch: " " };
      if (t && !b) return { ch: "▀", fg: t };
      if (!t && b) return { ch: "▄", fg: b };
      if (t === b) return { ch: "█", fg: t };
      return { ch: "▀", fg: t, bg: b };
    });
    rows.push(cells);
  }
  return rows;
}

// Merges neighbouring cells of one style into runs, the shape a renderer
// draws as one styled text span each.
export function cellsToRuns(row) {
  const runs = [];
  for (const cell of row) {
    const last = runs[runs.length - 1];
    if (last && last.fg === cell.fg && last.bg === cell.bg) last.text += cell.ch;
    else runs.push({ text: cell.ch, fg: cell.fg, bg: cell.bg });
  }
  return runs;
}

export function spriteRuns(monster, mode, frame) {
  return gridToCells(spriteGrid(monster, mode, frame)).map(cellsToRuns);
}

// Slot names a sprite uses, resolved against a palette.
export function slotColor(monster, slot, palette) {
  if (slot === "body") return palette[monster.color] ?? palette.accent;
  if (slot === "accent") return palette[monster.accent] ?? palette.fg;
  return palette[slot] ?? slot;
}
