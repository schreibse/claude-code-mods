// GENERATED from shared/scenes.mjs by scripts/sync-shared.mjs. Edit the original.
// Scenes: the monster with props (a burger, a guitar, a laser sword…) and a
// small column of effects beside it (zZ, notes, sparks, "GOL!").
//
// Idle scenes play while the agent waits for you, cheer scenes while you
// type a prompt; work scenes follow Claude
// Code's turn modes, a different one every few seconds. Each scene is a
// function of the frame number that says the monster's pose and position,
// which props to draw where, and the effects text. Pure module shared by the
// herdr plugin and the mod.

import { cellsToRuns, gridToCells, hashString, spriteGrid } from "./monsters.mjs";
import { ART_CHEER, CHEER } from "./scenes-cheer.mjs";
import { ART_MORE, IDLE_MORE, IDLE_PARTY, POOLS_MORE, WORK_INDUSTRIAL, WORK_MEMES, WORK_MORE } from "./scenes-more.mjs";

export const SCENE_WIDTH = 20; // pixels, one text column each
export const SCENE_HEIGHT = 6; // pixels, two per text row

// ---- props: rows of characters, each mapped to a palette slot ----

const SLOTS = { o: "orange", g: "green", r: "red", y: "yellow", f: "fg", b: "blue", c: "cyan", m: "magenta", a: "accent", u: "muted" };

const ART = {
  // food and drink
  burger: [".oooo.", "gggggg", "rrrrrr", ".oooo."],
  mug: ["oooo.", "ffffu", "ffffu", "ffff."],
  pizza: ["oooooo", ".yryy.", "..yr..", "...y.."],
  icecream: [".mm.", "mmmm", ".oo.", ".oo.", "..o."],
  boba: ["...u", "cccc", "cccc", "cucu", ".cc."],
  popcorn: ["f.f.", "ffff", "rfrf", "rfrf", "rfrf"],
  // home and cleaning
  door: ["uuuuu", "u...u", "u..yu", "u...u", "uuuuu", "uuuuu"],
  book: ["bbbbbb", "bffffb", "bffffb", "bbbbbb"],
  broomA: ["...o", "..o.", ".o..", "yyy.", "yyy."],
  broomB: ["o...", ".o..", "..o.", ".yyy", ".yyy"],
  vacuum: ["u....", "u....", "u....", "urrr.", "rrrrr", ".u.u."],
  plate: [".ffff.", "ffffff", ".ffff."],
  can: ["c..ccc", "cccccc", ".cccc."],
  sprout: [".g.", "ooo", ".o."],
  plant: ["ggg", ".g.", "ooo", ".o."],
  tree: ["g.g.g", "ggggg", ".ggg.", "..o..", ".ooo."],
  washerA: ["uuuuuu", "uuuuyu", "u.cc.u", "u.cc.u", "uuuuuu"],
  washerB: ["uuuuuu", "uuuuyu", "u.bb.u", "u.bb.u", "uuuuuu"],
  duck: [".yy..", "yyyo.", ".yyyy", ".yyy."],
  // music and screens
  guitar: ["....u", "...u.", "ooou.", "oooo.", ".oo.."],
  decksA: ["uuuuuu", "ummmmu", "uuuuuu"],
  decksB: ["uuuuuu", "umffmu", "uuuuuu"],
  mic: [".u", ".u", "u.", "u.", "u."],
  controller: ["uuuuuu", "ufuurr", "uuuuuu"],
  phone: ["uuu", "ucu", "ucu", "uuu"],
  telescope: ["....uu", "...uu.", "..uu..", ".u..u.", "u....u"],
  easel: ["uuuuu", "u...u", "u...u", "uuuuu", ".u.u."],
  // pop culture
  saberBlue: ["c", "c", "c", "c", "u", "u"],
  saberRed: ["r", "r", "r", "r", "u", "u"],
  pokeball: ["rr", "ff"],
  pipe: ["gggg", ".gg.", ".gg.", ".gg."],
  coin: ["yy"],
  // sports
  soccer: ["ff", "ff"],
  goal: ["uuuu", "u..u", "u..u", "u..u"],
  hoop: ["rrrr", "u..u", ".uu.", "..u.", "..u.", "..u."],
  orange: ["oo", "oo"],
  racket: [".yyy", ".y.y", ".yyy", "..o.", "..o."],
  dot: ["y"],
  barbell: ["u........u", "uuuuuuuuuu", "u........u"],
  board: ["oooooooooo"],
  waves: ["c.cc.cc.cc.cc.cc.cc."],
  wavesB: [".cc.cc.cc.cc.cc.cc.c"],
  rod: ["ooooo.", "....c.", "....c.", "....c.", "...ccc"],
  fish: ["oo.", "ooo"],
  // work
  laptop: [".uuuuu.", ".ucccu.", ".uuuuu.", "uuuuuuu"],
  hammerUp: [".uu", ".uu", "..y", "..y", "..y"],
  hammerDown: ["....", "....", "....", "yyyuu", "...uu"],
  keyboard: ["uuuuuuu"],
  dish: ["...u.", "u.u..", ".uu..", "..u..", ".uuu."],
  bird: ["u.u", ".u."],
  letter: ["ff", "ff"],
  handset: ["uu..", "u...", "u...", "uu.."],
  mailbox: ["bbbb", "b..b", "bbbb", ".u..", ".u.."],
  rocket: [".f.", "fff", "fbf", "fff", "r.r"],
  tower: [".u.", "uuu", ".u.", "u.u", "u.u"],
  chess: ["fufu", "ufuf", "fufu", "ufuf"],
  bulbOn: [".yy.", "yyyy", ".yy.", ".uu."],
  bulbOff: [".uu.", "u..u", ".uu.", ".uu."],
  crystalA: [".mm.", "mmmm", "mmmm", ".mm.", "uuuu"],
  crystalB: [".aa.", "aaaa", "aaaa", ".aa.", "uuuu"],
  magnifier: [".uu.", "u..u", "u..u", ".uu.", "...u"],
  gearA: ["u.u", "uuu", "u.u"],
  gearB: ["uuu", "u.u", "uuu"],
  wrench: ["y..", ".y.", "..y"],
  log: ["oooooo", "oooooo"],
  saw: ["uuuu", "uu.."],
  drill: ["uuuy", "uu..", ".u.."],
  flask: [".u.", ".u.", "ggg", "ggg"],
  torch: ["u.", "uu"],
  box: ["oooo", "oyyo", "oooo"],
  pickUp: ["uuu", ".o.", ".o."],
  pickDown: ["...", "uo.", "uoo"],
  grass: ["gggg", "oooo", "oooo"],
  net: ["..ff", ".f.f", "o.ff", "o..."],
  roller: ["uuu", ".o.", ".o."],
  typewriter: ["uuuuuu", "uuuuuu"],
  quill: ["...f", "..f.", ".f..", "o..."],
  piano: ["fufuff", "fufuff", "ffffff"],
  printer: ["uuuuu", "uuuuu", ".fff."],
  chalkboard: ["gggggg", "g....g", "g....g", "gggggg"],
  telegraph: ["uuuu", ".uu.", "uuuu"],
  needles: ["u...u", ".u.u."],
  megaphone: ["...y", "..yy", "yyyy", "..yy", "...y"],
};

function blankGrid() {
  return Array.from({ length: SCENE_HEIGHT }, () => Array(SCENE_WIDTH).fill(null));
}

// Draws an art (a name in ART, or rows given inline) at x, y. `cut` skips its
// first columns (a bitten burger), `light` lights one column (a pressed key).
function drawArt(grid, art, x, y, { cut = 0, light = -1, slot = null } = {}) {
  const rows = typeof art === "string" ? ART[art] : art;
  if (!rows) return;
  rows.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      if (ch === "." || dx < cut) return;
      const gy = y + dy;
      const gx = x + dx;
      if (gy < 0 || gy >= SCENE_HEIGHT || gx < 0 || gx >= SCENE_WIDTH) return;
      grid[gy][gx] = dx === light ? "accent" : slot ?? SLOTS[ch] ?? ch;
    });
  });
}

// The monster's 12 px sprite placed at column `ox`, clipped to the scene.
function drawMonster(grid, monster, pose, frame, ox = 1) {
  const sprite = spriteGrid(monster, pose, frame);
  sprite.forEach((row, y) => {
    row.forEach((cell, x) => {
      const gx = x + ox - 1;
      if (cell && gx >= 0 && gx < SCENE_WIDTH) grid[y][gx] = cell;
    });
  });
}

// ---- helpers for scene definitions ----

const BLANK = ["", "", ""];
const cyc = (t, list, period = 1) => list[Math.floor(t / period) % list.length];
const mid = (text) => ["", text, ""];

function rising(glyphs, frame, period = 3) {
  const step = Math.floor(frame / period) % (glyphs.length + 1);
  const rows = ["", "", ""];
  for (let i = 0; i < Math.min(step, glyphs.length); i++) rows[2 - i] = " ".repeat(i) + glyphs[i];
  return rows;
}

// A scene is a function of the frame: { pose, ox, props: [[art, x, y, opts]],
// fx: [3 strings], fxSlot, caption, hide }.
const IDLE = {
  // the first six
  sleep: (t) => ({ pose: "sleep", fx: rising(["z", "z", "Z"], t), fxSlot: "blue", caption: "is napping" }),
  eat: (t) => {
    const bites = Math.floor((t % 36) / 6);
    return {
      pose: bites < 6 ? "chew" : "idle",
      props: bites < 6 ? [["burger", 12, 1, { cut: bites }]] : [],
      fx: t % 6 < 3 && bites > 0 ? mid("nom") : BLANK,
      fxSlot: "orange",
      caption: "is having a snack",
    };
  },
  drink: (t) => {
    const sip = t % 16 >= 10;
    return {
      pose: sip ? "chew" : "idle",
      props: [["mug", 12, sip ? 0 : 2]],
      fx: sip ? mid("ahh") : cyc(t, [[" ~", "~", ""], ["~", " ~", ""]], 2),
      fxSlot: "muted",
      caption: "is sipping coffee",
    };
  },
  bathroom: (t) => {
    const p = t % 60;
    const hide = p >= 14 && p < 44;
    const ox = p < 14 ? 1 + Math.floor(p / 2) : hide ? 8 : 8 - Math.floor((p - 44) / 2);
    return {
      pose: hide ? "idle" : "walk",
      ox,
      hide,
      props: [["door", 15, 0]],
      fx: hide && t % 6 < 3 ? ["WC", "", "brb"] : ["WC", "", ""],
      fxSlot: "muted",
      caption: hide ? "is in the bathroom" : "is going to the bathroom",
    };
  },
  play: (t) => {
    const by = cyc(t, [4, 2, 1, 0, 1, 2, 4]);
    return { pose: by >= 4 ? "hop" : "idle", props: [["orange", 14, by, { slot: "red" }]], fx: by >= 4 ? ["", "", "!"] : BLANK, fxSlot: "yellow", caption: "is playing ball" };
  },
  read: (t) => ({ pose: "read", props: [["book", 12, 2]], fx: t % 20 >= 17 ? mid("flip") : BLANK, fxSlot: "muted", caption: "is reading the docs" }),

  // cleaning and chores
  sweep: (t) => ({ pose: "walk", ox: 1 + (Math.floor(t / 2) % 3), props: [[cyc(t, ["broomA", "broomB"], 2), 14, 1]], fx: cyc(t, [["", "", "∴"], ["", "", " ·:"], BLANK], 2), fxSlot: "muted", caption: "is sweeping the floor" }),
  vacuum: (t) => ({ pose: "walk", ox: 1 + (t % 4 < 2 ? 0 : 1), props: [["vacuum", 13 + (t % 4 < 2 ? 0 : 1), 0]], fx: mid(cyc(t, ["vrr", "vrrr", "vr"])), fxSlot: "red", caption: "is vacuuming" }),
  dishes: (t) => ({ pose: "chew", props: [["plate", 12, 3]], fx: cyc(t, [["°", " o", ""], [" o", "°", ""], ["", " °", "o"]], 2), fxSlot: "cyan", caption: "is washing the dishes" }),
  garden: (t) => {
    const grow = Math.floor((t % 30) / 10);
    const plant = ["sprout", "plant", "tree"][grow];
    return { pose: "idle", props: [["can", 11, 0], [plant, 16, 6 - ART[plant].length]], fx: cyc(t, [["", " '", ""], ["", "'", " '"]], 2), fxSlot: "cyan", caption: "is watering the plants" };
  },
  laundry: (t) => ({ pose: t % 10 < 5 ? "idle" : "hop", props: [[cyc(t, ["washerA", "washerB"]), 13, 1]], fx: mid(cyc(t, ["~", "~~", "~~~"])), fxSlot: "cyan", caption: "is doing the laundry" }),

  // music and screens
  guitar: (t) => ({ pose: "hop", props: [["guitar", 10, 1]], fx: cyc(t, [["♪", "", ""], [" ♫", "♪", ""], ["", " ♫", "♪"]], 2), fxSlot: "magenta", caption: "is shredding a guitar solo" }),
  dj: (t) => ({ pose: "hop", props: [[cyc(t, ["decksA", "decksB"]), 12, 3]], fx: cyc(t, [["♪", "", " ♬"], ["", "♬", ""], [" ♪", "", "♪"]], 2), fxSlot: "magenta", caption: "is dropping a beat" }),
  karaoke: (t) => ({ pose: t % 4 < 2 ? "chew" : "hop", props: [["mic", 11, 1]], fx: cyc(t, [mid("♪ la"), ["la ♪", "", ""], mid("")], 2), fxSlot: "magenta", caption: "is singing karaoke" }),
  gaming: (t) => ({ pose: "read", props: [["controller", 12, 3]], fx: mid(cyc(t, ["↑↑", "↓↓", "←→", "←→", "B A"], 2)), fxSlot: "accent", caption: "is entering the cheat code" }),
  selfie: (t) => ({ pose: t % 12 === 11 ? "done" : "idle", props: [["phone", 13, 1]], fx: t % 12 === 11 ? mid("✧ click") : BLANK, fxSlot: "yellow", caption: "is taking a selfie" }),
  movie: (t) => ({ pose: "chew", props: [["popcorn", 13, 1]], fx: cyc(t, [["pop", "", ""], ["", " pop", ""], BLANK], 2), fxSlot: "yellow", caption: "is watching a movie" }),
  stargazing: (t) => ({ pose: "read", props: [["telescope", 12, 0]], fx: cyc(t, [["✦", "  ☆", ""], [" ☆", "", "✦"]], 3), fxSlot: "yellow", caption: "is stargazing" }),
  painting: (t) => {
    const fill = Math.floor((t % 32) / 4);
    const dots = [[1, 1, "r"], [2, 1, "y"], [3, 1, "b"], [1, 2, "g"], [2, 2, "m"], [3, 2, "c"], [2, 1, "o"], [1, 1, "a"]].slice(0, fill);
    const canvas = ["uuuuu", "u...u", "u...u", "uuuuu", ".u.u."].map((r) => [...r]);
    for (const [x, y, c] of dots) canvas[y][x] = c;
    return { pose: "idle", props: [[canvas.map((r) => r.join("")), 13, 1]], fx: mid(t % 8 < 4 ? "~" : ""), fxSlot: "magenta", caption: "is painting a masterpiece" };
  },

  // pop culture
  saber: (t) => ({ pose: t % 6 < 3 ? "tool-use" : "idle", props: [[cyc(t, ["saberBlue", "saberRed"], 6), 12, 0]], fx: mid(cyc(t, ["vmm", "VMM", "vmm"], 2)), fxSlot: t % 12 < 6 ? "cyan" : "red", caption: "is training with a laser sword" }),
  catchem: (t) => {
    const p = t % 12;
    const x = 12 + Math.min(p, 6);
    const y = [3, 1, 0, 1, 2, 4, 4][Math.min(p, 6)];
    return { pose: p < 2 ? "tool-use" : "idle", props: [["pokeball", x, y]], fx: p >= 8 ? mid(p % 2 ? "gotcha!" : "...") : BLANK, fxSlot: "red", caption: "is catching them all" };
  },
  plumber: (t) => {
    const up = t % 8 < 4;
    return { pose: up ? "hop" : "idle", props: [["pipe", 14, 2], ...(up ? [["coin", 15, 0]] : [])], fx: up ? mid("◎ +1") : BLANK, fxSlot: "yellow", caption: "is jumping for coins" };
  },
  duck: (t) => ({ pose: t % 8 < 4 ? "chew" : "idle", props: [["duck", 13, 2]], fx: t % 8 >= 4 ? mid("quack") : BLANK, fxSlot: "yellow", caption: "is rubber-duck debugging" }),
  matrix: (t) => ({ pose: "read", fx: [cyc(t, ["1 0", "0 1"]), cyc(t, ["0 1", "1 0"]), cyc(t, ["1 1", "0 0"])], fxSlot: "green", caption: "sees the matrix" }),

  // sports
  soccer: (t) => {
    const p = t % 14;
    const x = p < 2 ? 11 : Math.min(17, 11 + p);
    return { pose: p < 2 ? "tool-use" : "idle", props: [["goal", 16, 2], ["soccer", x, 4]], fx: p >= 8 && p < 13 ? mid(p % 2 ? "GOL!" : "GOOL!") : BLANK, fxSlot: "green", caption: "is playing football" };
  },
  basketball: (t) => {
    const arc = [[11, 4], [12, 2], [13, 1], [14, 0], [15, 1], [16, 1], [16, 3], [16, 4]];
    const [x, y] = cyc(t, arc);
    return { pose: t % arc.length < 2 ? "hop" : "idle", props: [["hoop", 15, 0], ["orange", x, y]], fx: t % arc.length >= 6 ? mid("swish") : BLANK, fxSlot: "orange", caption: "is shooting hoops" };
  },
  tennis: (t) => {
    const p = t % 10;
    const x = p < 5 ? 15 + p : 24 - p;
    return { pose: p === 0 ? "tool-use" : "idle", props: [["racket", 11, 0], ["dot", Math.min(x, 19), 1 + (p % 3)]], fx: p === 0 ? mid("pok") : BLANK, fxSlot: "yellow", caption: "is playing tennis" };
  },
  lifting: (t) => {
    const up = t % 8 >= 4;
    return { pose: up ? "idle" : "chew", props: [["barbell", 1, up ? 0 : 1]], fx: up ? mid("hnng") : BLANK, fxSlot: "red", caption: "is lifting weights" };
  },
  yoga: (t) => ({ pose: t % 8 < 4 ? "sleep" : "idle", fx: mid(t % 8 < 4 ? "om" : "  om"), fxSlot: "magenta", caption: "is doing yoga" }),
  skate: (t) => {
    const ox = 1 + cyc(t, [0, 1, 2, 3, 4, 3, 2, 1]);
    const air = t % 8 === 4;
    return { pose: "hop", ox, props: [["board", ox, air ? 4 : 5]], fx: air ? mid("ollie!") : BLANK, fxSlot: "orange", caption: "is skateboarding" };
  },
  swim: (t) => ({ pose: "hop", props: [[cyc(t, ["waves", "wavesB"]), 0, 5]], fx: cyc(t, [mid("splash"), BLANK, BLANK]), fxSlot: "cyan", caption: "is going for a swim" }),
  fishing: (t) => {
    const bite = t % 16 >= 12;
    return { pose: bite ? "done" : "idle", props: [["rod", 11, 0], ...(bite ? [["fish", 16, 2]] : [])], fx: bite ? mid("!") : BLANK, fxSlot: "orange", caption: bite ? "caught a fish!" : "is fishing" };
  },
  juggling: (t) => {
    const spots = [[12, 4], [13, 1], [15, 0], [17, 1], [18, 4]];
    const balls = ["r", "g", "b"].map((c, i) => [[c], ...cyc(t + i * 2, spots)]);
    return { pose: "hop", props: balls.map(([art, x, y]) => [art, x, y]), fx: BLANK, fxSlot: "fg", caption: "is juggling" };
  },
  meditate: (t) => ({ pose: t % 6 < 3 ? "hop" : "sleep", fx: cyc(t, [["✧", "", ""], ["", " ✧", ""], ["", "", "✧"]], 2), fxSlot: "accent", caption: "is levitating" }),
  snack: (t) => {
    const bites = Math.floor((t % 30) / 5);
    return { pose: "chew", props: bites < 6 ? [["pizza", 12, 1, { cut: bites }]] : [], fx: bites > 0 && t % 5 < 2 ? mid("nom") : BLANK, fxSlot: "orange", caption: "is eating pizza" };
  },
  icecream: (t) => ({ pose: t % 4 < 2 ? "chew" : "idle", props: [["icecream", 13, 1]], fx: t % 8 < 2 ? mid("♥") : BLANK, fxSlot: "magenta", caption: "is having ice cream" }),
  boba: (t) => ({ pose: t % 10 >= 7 ? "chew" : "idle", props: [["boba", 13, 1]], fx: t % 10 >= 7 ? mid("slurp") : BLANK, fxSlot: "cyan", caption: "is drinking bubble tea" }),
};

Object.assign(ART, ART_MORE, ART_CHEER);
Object.assign(IDLE, IDLE_MORE, IDLE_PARTY);

export const IDLE_SCENES = Object.keys(IDLE);

// Work scenes, grouped by the turn mode they suit.
const WORK = {
  // requesting: talking to the model
  laptop: (t) => ({ pose: "requesting", props: [["laptop", 12, 2]], fx: mid(cyc(t, [")", "))", ")))", ""])), fxSlot: "cyan", caption: "is calling Claude" }),
  satellite: (t) => ({ pose: "read", props: [["dish", 12, 1]], fx: cyc(t, [["", "", "·"], ["", " ·)", ""], ["·))", "", ""]]), fxSlot: "cyan", caption: "is pinging the satellite" }),
  pigeon: (t) => {
    const x = 12 + (t % 8);
    return { pose: "idle", props: [["bird", x, cyc(t, [0, 1])], ["letter", x, 2]], fx: BLANK, fxSlot: "fg", caption: "is sending a carrier pigeon" };
  },
  phonecall: (t) => ({ pose: "chew", props: [["handset", 11, 1]], fx: mid(cyc(t, ["ring", "ring!", ""], 2)), fxSlot: "yellow", caption: "is on the phone" }),
  mail: (t) => ({ pose: "walk", props: [["mailbox", 15, 1], ["letter", 12 + (t % 4), 2]], fx: t % 4 === 3 ? mid("sent") : BLANK, fxSlot: "blue", caption: "is mailing a request" }),
  launch: (t) => {
    const p = t % 12;
    return { pose: p > 5 ? "done" : "idle", props: [["rocket", 15, p > 5 ? 6 - p : 1]], fx: p <= 5 ? mid(String(Math.max(1, 3 - Math.floor(p / 2)))) : mid("liftoff"), fxSlot: "red", caption: "is launching a rocket" };
  },
  radio: (t) => ({ pose: "idle", props: [["tower", 14, 1]], fx: cyc(t, [mid("(·)"), ["", "((·))", ""], ["(((", "", ")))"]]), fxSlot: "accent", caption: "is broadcasting" }),

  // thinking
  bubbles: (t) => {
    const step = Math.floor(t / 3) % 5;
    return { pose: "thinking", fx: step === 4 ? ["!", " o", "°"] : rising(["°", "o", "O?"], t), fxSlot: step === 4 ? "yellow" : "fg", caption: "is thinking" };
  },
  chess: (t) => ({ pose: "thinking", props: [["chess", 13, 2], [["r"], 13 + (Math.floor(t / 4) % 4), 2 + (Math.floor(t / 8) % 4)]], fx: t % 16 === 15 ? mid("check") : BLANK, fxSlot: "red", caption: "is playing chess" }),
  cube: (t) => {
    const colors = "rgbyom";
    const face = [0, 1, 2].map((r) => [0, 1, 2].map((c) => colors[(r * 3 + c + Math.floor(t / 2)) % 6]).join(""));
    const solved = t % 24 >= 20;
    return { pose: solved ? "done" : "thinking", props: [[solved ? ["rrr", "rrr", "rrr"] : face, 14, 2]], fx: solved ? mid("solved") : BLANK, fxSlot: "green", caption: "is solving the cube" };
  },
  idea: (t) => ({ pose: t % 10 >= 8 ? "done" : "thinking", props: [[t % 10 >= 8 ? "bulbOn" : cyc(t, ["bulbOff", "bulbOff", "bulbOn", "bulbOff"]), 14, 0]], fx: t % 10 >= 8 ? mid("aha!") : BLANK, fxSlot: "yellow", caption: "is having an idea" }),
  whiteboard: (t) => {
    const n = Math.floor((t % 24) / 3);
    const board = ["ffffff", "f....f", "f....f", "ffffff", ".u..u."].map((r) => [...r]);
    for (let i = 0; i < n; i++) board[1 + (i % 2)][1 + Math.floor(i / 2)] = "b";
    return { pose: "read", props: [[board.map((r) => r.join("")), 13, 0]], fx: BLANK, fxSlot: "fg", caption: "is sketching on the whiteboard" };
  },
  crystal: (t) => ({ pose: "thinking", props: [[cyc(t, ["crystalA", "crystalB"], 2), 14, 1]], fx: cyc(t, [mid("✧"), ["✦", "", ""], BLANK]), fxSlot: "magenta", caption: "is consulting the crystal ball" }),
  detective: (t) => ({ pose: "walk", ox: 1 + (Math.floor(t / 2) % 3), props: [["magnifier", 14, 1]], fx: mid(cyc(t, ["?", "hmm", "?"], 3)), fxSlot: "fg", caption: "is investigating" }),
  blocks: (t) => {
    const rows = Math.floor((t % 24) / 4);
    const stack = ["rrbb", "gyyo", "mmcc", "bbgg", "ooyy", "ccrr"].slice(0, rows).reverse();
    const fall = (t % 4) + 0;
    return { pose: "thinking", props: [[stack, 14, 6 - stack.length], [["aa"], 15, Math.min(fall, 5 - stack.length)]], fx: rows === 5 ? mid("line!") : BLANK, fxSlot: "accent", caption: "is stacking blocks" };
  },

  // tool use
  hammer: (t) => {
    const down = t % 2 === 1;
    return { pose: "tool-use", props: [[down ? "hammerDown" : "hammerUp", 12, 0]], fx: down ? ["", "✦", "· ✦"] : BLANK, fxSlot: "yellow", caption: "is hammering away" };
  },
  gears: (t) => ({ pose: "tool-use", props: [[cyc(t, ["gearA", "gearB"]), 15, 1], ["wrench", 12, cyc(t, [1, 2])]], fx: t % 4 === 0 ? mid("clank") : BLANK, fxSlot: "muted", caption: "is tightening bolts" }),
  saw: (t) => ({ pose: "tool-use", props: [["log", 12, 4], ["saw", 12 + (t % 3), 2]], fx: cyc(t, [["", "", "∴"], ["", "", " ∵"]]), fxSlot: "orange", caption: "is sawing wood" }),
  drill: (t) => ({ pose: "tool-use", props: [["drill", 12, 2]], fx: mid(cyc(t, ["brr", "brrr", "rrr"])), fxSlot: "yellow", caption: "is drilling" }),
  lab: (t) => ({ pose: "thinking", props: [["flask", 14, 2]], fx: cyc(t, [["", "", "o"], ["", "°", ""], ["°", "", ""]]), fxSlot: "green", caption: "is mixing potions" }),
  weld: (t) => ({ pose: "tool-use", props: [["torch", 12, 3], ["log", 14, 4]], fx: cyc(t, [["*", "✦", ""], ["", "*", "✦"], ["✦", "", "*"]]), fxSlot: "orange", caption: "is welding" }),
  boxes: (t) => {
    const lifted = t % 8 < 4;
    return { pose: lifted ? "walk" : "idle", ox: 1 + (t % 8 < 4 ? Math.floor((t % 4) / 2) : 0), props: [["box", lifted ? 4 : 14, lifted ? 0 : 3]], fx: BLANK, fxSlot: "fg", caption: "is moving boxes" };
  },
  mining: (t) => {
    const down = t % 2 === 1;
    return { pose: "tool-use", props: [["grass", 15, 3], [down ? "pickDown" : "pickUp", 12, down ? 2 : 0]], fx: down ? mid("tok") : BLANK, fxSlot: "muted", caption: "is mining blocks" };
  },
  bugnet: (t) => {
    const caught = t % 12 >= 9;
    return { pose: caught ? "done" : "walk", props: [["net", 12, 1], ...(caught ? [] : [[["r"], 16 + (t % 3), cyc(t, [0, 2, 1])]])], fx: caught ? mid("got it") : BLANK, fxSlot: "red", caption: "is catching a bug" };
  },
  roller: (t) => {
    const n = Math.floor((t % 24) / 3);
    const wall = Array.from({ length: 5 }, () => "b".repeat(n).padEnd(8, "."));
    return { pose: "tool-use", props: [[wall, 12, 0], ["roller", 12 + Math.min(n, 7), 2]], fx: BLANK, fxSlot: "blue", caption: "is painting the wall" };
  },

  // responding: writing the answer
  keyboard: (t) => {
    const letters = ["a", "{", "</", "ok", ";", "fn", "=>"];
    const fx = ["", "", ""];
    fx[2 - (t % 3)] = " ".repeat(t % 3) + letters[Math.floor(t / 3) % letters.length];
    return { pose: "responding", props: [["keyboard", 12, 5, { light: t % 7 }]], fx, fxSlot: "accent", caption: "is typing" };
  },
  typewriter: (t) => ({ pose: "responding", props: [[Array.from({ length: 1 + (Math.floor(t / 3) % 3) }, () => "ffff"), 13, 3 - (Math.floor(t / 3) % 3)], ["typewriter", 12, 4]], fx: t % 6 === 5 ? mid("ding") : BLANK, fxSlot: "yellow", caption: "is on the typewriter" }),
  quill: (t) => {
    const n = Math.floor((t % 20) / 4);
    const scroll = ["ffffff", ...Array.from({ length: 3 }, (_, i) => (i < n ? "fuuuuf" : "f....f")), "ffffff"];
    return { pose: "read", props: [[scroll, 13, 1], ["quill", 11, 0]], fx: BLANK, fxSlot: "fg", caption: "is writing with a quill" };
  },
  piano: (t) => ({ pose: "hop", props: [["piano", 12, 3, { light: t % 6 }]], fx: cyc(t, [["♪", "", ""], ["", " ♫", ""], ["", "", "♪"]]), fxSlot: "magenta", caption: "is playing the piano" }),
  printer: (t) => {
    const n = Math.floor((t % 15) / 3);
    return { pose: "idle", props: [["printer", 12, 1], [Array.from({ length: n }, () => "fff"), 13, 4 - Math.min(n, 2) + 2]], fx: mid(cyc(t, ["brr", "zzt", ""])), fxSlot: "muted", caption: "is printing the answer" };
  },
  chalk: (t) => {
    const n = Math.floor((t % 16) / 2);
    const board = ["gggggg", "g....g", "g....g", "gggggg"].map((r) => [...r]);
    for (let i = 0; i < n; i++) board[1 + (i % 2)][1 + Math.floor(i / 2)] = "f";
    return { pose: "responding", props: [[board.map((r) => r.join("")), 13, 1]], fx: BLANK, fxSlot: "fg", caption: "is writing on the chalkboard" };
  },
  telegraph: (t) => ({ pose: t % 2 ? "chew" : "idle", props: [["telegraph", 13, 3]], fx: mid(cyc(t, ["·", "·−", "·−·", "−·−"])), fxSlot: "yellow", caption: "is tapping out morse" }),
  knitting: (t) => {
    const n = 1 + (Math.floor(t / 4) % 4);
    return { pose: "chew", props: [["needles", 12, 1], [Array.from({ length: n }, (_, i) => (i % 2 ? "rrr" : "fff")), 13, 2]], fx: BLANK, fxSlot: "red", caption: "is knitting a reply" };
  },
  megaphone: (t) => ({ pose: "responding", props: [["megaphone", 12, 1]], fx: cyc(t, [mid(")"), mid("))"), mid(")))hey")]), fxSlot: "yellow", caption: "is announcing the answer" }),

  // states
  blocked: (t) => ({ pose: "blocked", fx: t % 4 < 2 ? mid("!") : mid("!!"), fxSlot: "red", caption: "needs you" }),
  done: (t) => ({ pose: "done", fx: t % 4 < 2 ? ["✦", " ✧", "✦"] : [" ✧", "✦", " ✧"], fxSlot: "yellow", caption: "is done" }),
};

Object.assign(WORK, WORK_MORE, WORK_MEMES, WORK_INDUSTRIAL);

const TOOLS = ["hammer", "gears", "saw", "drill", "lab", "weld", "boxes", "mining", "bugnet", "roller", ...POOLS_MORE.tool];

export const WORK_POOLS = {
  requesting: ["laptop", "satellite", "pigeon", "phonecall", "mail", "launch", "radio", ...POOLS_MORE.requesting],
  thinking: ["bubbles", "chess", "cube", "idea", "whiteboard", "crystal", "detective", "blocks", ...POOLS_MORE.thinking],
  "tool-input": TOOLS,
  "tool-use": TOOLS,
  responding: ["keyboard", "typewriter", "quill", "piano", "printer", "chalk", "telegraph", "knitting", "megaphone", ...POOLS_MORE.responding],
  blocked: ["blocked"],
  done: ["done"],
};

export const WORK_SCENES = Object.keys(WORK);

// Which idle scene plays now: a new one every 40 seconds, in an order that
// differs per monster.
export function idleSceneAt(monster, now, period = 40_000) {
  const block = Math.floor(now / period);
  return IDLE_SCENES[hashString(`${monster.seed}:${block}`) % IDLE_SCENES.length];
}

// Which work scene suits a mode now: a new one every 15 seconds.
export function workSceneAt(monster, mode, now, period = 15_000) {
  const pool = WORK_POOLS[mode] ?? WORK_POOLS.thinking;
  const block = Math.floor(now / period);
  return pool[hashString(`${monster.seed}:${mode}:${block}`) % pool.length];
}

// Cheer scenes play while you type a prompt: a new one every 10 seconds.
export const CHEER_SCENES = Object.keys(CHEER);

export function cheerSceneAt(monster, now, period = 10_000) {
  const block = Math.floor(now / period);
  return CHEER_SCENES[hashString(`${monster.seed}:cheer:${block}`) % CHEER_SCENES.length];
}

export function scene(monster, name, frame) {
  const make = IDLE[name] ?? WORK[name] ?? CHEER[name] ?? WORK[WORK_POOLS[name]?.[0]] ?? IDLE.sleep;
  const s = make(frame);
  const grid = blankGrid();
  if (!s.hide) drawMonster(grid, monster, s.pose ?? "idle", frame, s.ox ?? 1);
  for (const [art, x, y, opts] of s.props ?? []) drawArt(grid, art, x, y, opts);
  return {
    rows: gridToCells(grid).map(cellsToRuns),
    fx: (s.fx ?? BLANK).map((f) => f.padEnd(6)),
    fxSlot: s.fxSlot ?? "fg",
    caption: s.caption ?? "",
  };
}

// ---- the GitHub critter: a small octocat for the repository column ----

const OCTOCAT = [
  [".#....#.", ".#....#."],
  ["########", "########"],
  ["#o####o#", "########"], // blinks now and then
  ["########", "########"],
  [".######.", ".######."],
  ["#.#..#.#", ".#.##.#."], // tentacles wiggle
];

// 8x6 px in `slot`, as rows of runs like scene() gives.
export function octocat(frame, slot = "fg") {
  const blink = frame % 18 === 17 ? 1 : 0;
  const wiggle = Math.floor(frame / 2) % 2;
  const grid = OCTOCAT.map((variants, y) => {
    const row = y === 2 ? variants[blink] : y === 5 ? variants[wiggle] : variants[0];
    return [...row].map((ch) => (ch === "#" ? slot : null));
  });
  return gridToCells(grid).map(cellsToRuns);
}

// ---- the GitLab critter: a small fox ----

const FOX = [
  ["r......r", "r......r"],
  ["rr....rr", "rr....rr"],
  ["roooooor", "roooooor"],
  ["o.oooo.o", "oooooooo"], // blinks now and then
  [".oooooo.", ".oooooo."],
  ["..yyyy..", "...yy..."], // the chin moves as it talks
];
const FOX_SLOTS = { r: "red", o: "orange", y: "yellow" };

// 8x6 px in the fox's own colors, as rows of runs like scene() gives.
export function gitlabFox(frame) {
  const blink = frame % 18 === 17 ? 1 : 0;
  const chin = Math.floor(frame / 3) % 2;
  const grid = FOX.map((variants, y) => {
    const row = y === 3 ? variants[blink] : y === 5 ? variants[chin] : variants[0];
    return [...row].map((ch) => FOX_SLOTS[ch] ?? null);
  });
  return gridToCells(grid).map(cellsToRuns);
}
