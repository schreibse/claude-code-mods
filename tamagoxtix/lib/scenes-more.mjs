// GENERATED from shared/scenes-more.mjs by scripts/sync-shared.mjs. Edit the original.
// More scenes for scenes.mjs: 30 idle (chores, pop culture, sports) and 30
// work scenes (a few per turn mode). Same shape as the scenes there: each is
// a function of the frame returning { pose, ox, props, fx, fxSlot, caption }.
//
// Pure module shared by the herdr plugin and the mod.

const cyc = (t, list, period = 1) => list[Math.floor(t / period) % list.length];
const mid = (text) => ["", text, ""];
const BLANK = ["", "", ""];

function rising(glyphs, frame, period = 3) {
  const step = Math.floor(frame / period) % (glyphs.length + 1);
  const rows = ["", "", ""];
  for (let i = 0; i < Math.min(step, glyphs.length); i++) rows[2 - i] = " ".repeat(i) + glyphs[i];
  return rows;
}
const fill = (rows, n, ch) => rows.map((r, i) => (i < n ? r.replace(/\./g, ch) : r));

export const ART_MORE = {
  // chores
  pan: ["u.....", "uuuuuo"],
  cake: ["..y..", "..f..", "fffff", "mmmmm", "fffff"],
  fireA: ["..y..", ".yry.", "ryoyr", "ooooo"],
  fireB: [".y...", "..yr.", ".ryry", "ooooo"],
  ironBoard: ["uuuuuuu", ".u...u."],
  iron: [".uu.", "uuuu"],
  duster: ["mmm", ".m.", ".o.", ".o."],
  bin: ["uuuuu", ".uuu.", ".uuu.", ".uuu."],
  mop: ["o..", "o..", "o..", "ccc"],
  window: ["bbbbb", "bcbcb", "bbbbb", "bcbcb", "bbbbb"],
  // pop culture
  discoA: ["..u..", ".fcf.", "cfcfc", ".fcf."],
  discoB: ["..u..", ".cfc.", "fcfcf", ".cfc."],
  arcadeA: ["uuuuu", "ucccu", "ucacu", "uuuuu", "uyruu", "uuuuu"],
  arcadeB: ["uuuuu", "uacau", "ucccu", "uuuuu", "uyruu", "uuuuu"],
  egg: [".gg.", "gyyg", "gggg", ".gg."],
  eggCracked: [".gg.", "guyg", "gugg", ".gg."],
  dragon: ["r..r", "rrrr", ".rr.", "r..r"],
  bluebox: ["..b..", "bbbbb", "bfbfb", "bbbbb", "bbbbb", "bbbbb"],
  capeA: ["rr..", "rrr.", ".rrr"],
  capeB: ["r...", "rrr.", "rrrr"],
  wand: ["...y", "..o.", ".o..", "o..."],
  city: [".u..u.", ".u.uu.", "uuuuuu"],
  ufo: [".uu.", "uuuu"],
  beam: ["y.y", ".y.", "y.y"],
  ship: ["..c..", ".ccc.", "c.c.c"],
  // sports
  bike: ["uu..uu", "u.uu.u", "uu..uu"],
  bag: ["u.", "rr", "rr", "rr", "rr"],
  surfboard: ["yyyyyyyyyy"],
  wave: ["....cc", "...ccc", "..cccc", "cccccc"],
  flag: ["r..", "rr.", "u..", "u..", "u.."],
  pins: ["f.f.f", ".f.f."],
  pinsDown: [".....", "ff.ff"],
  netPole: ["u", "u", "u", "u"],
  finish: ["fu", "uf", "fu", "uf", "fu"],
  rope: ["oooooooooo"],
  bat: ["..o", ".o.", "o.."],
  target: [".rrr.", "rfffr", "rfrfr", "rfffr", ".rrr."],
  holds: ["u.u..", "..u.u", "u..u.", ".u..u", "u.u.."],
  kite: [".m.", "mmm", ".m.", "..u", "...u"],
  // work: requesting
  smallFire: ["..y..", ".ryr.", "ooooo"],
  plane: ["f...", "ff..", "fff.", "ff.."],
  walkie: ["u.", "uu", "uu", "uu"],
  lighthouse: [".y.", "uuu", "rrr", "fff", "rrr", "fff"],
  beacon: ["..y..", ".yry.", "ryoyr", "..u..", "..u.."],
  // work: thinking
  abacusA: ["uuuuuu", "uryybu", "uyrbyu", "uuuuuu"],
  abacusB: ["uuuuuu", "uyrybu", "uryybu", "uuuuuu"],
  puzzleApart: ["r..g", "....", "b..y"],
  puzzleTogether: [".rg.", ".by."],
  map: ["yyyyyy", "y....y", "y....y", "yyyyyy"],
  compassA: [".uu.", "u.ru", "u..u", ".uu."],
  compassB: [".uu.", "u..u", "u.ru", ".uu."],
  compassC: [".uu.", "u..u", "ur.u", ".uu."],
  hourTop: ["uuuu", ".yy.", "..u.", ".u..", "....", "uuuu"],
  hourBottom: ["uuuu", "....", "..u.", ".u..", ".yy.", "uuuu"],
  maze: ["uuuuuu", "u..u.u", "u.uu.u", "u....u", "uuuuuu"],
  sudoku: ["fufuf", "ufufu", "fufuf"],
  // work: tools
  screwdriver: ["y", "y", "u", "u"],
  circuit: ["gggggg", "gyygyg", "gggggg"],
  solderIron: ["u..", ".u.", "..y"],
  sewing: ["uuuu.", "u..uu", "uuuuu"],
  crane: ["uuuuuu", ".u...u", ".u....", ".u....", ".u....", "uuu..."],
  frame3d: ["uuuuu", "u...u", "u...u", "uuuuu"],
  anvil: ["uuuu.", ".uu..", "uuuu."],
  belt: ["uuuuuuuu"],
  digger: ["..oo", ".o..", "o...", "oooo"],
  // work: responding
  stamp: ["oo", ".o", "rr"],
  paper: ["ffff", "ffff"],
  clapOpen: ["f.u.", ".u.f", "ffff", "ffff"],
  clapShut: ["fufu", "ffff", "ffff"],
  neonOn: ["mmmmm", "m.a.m", "mmmmm"],
  neonOff: ["uuuuu", "u...u", "uuuuu"],
  fax: ["uuuu", "uuuu", ".ff."],
  craneFolded: ["f..f", ".ff.", "ffff"],
  craneFlat: ["ffff", "ffff", "ffff"],
  // work: memes and IT life
  flames: ["y..y..y", "ry.ry.r", "rorroro"],
  calendar: ["rrrr", "ffff", "fuff", "ffff"],
  terminal: ["uuuuuu", "ug...u", "u....u", "uuuuuu"],
  powerOn: [".gg.", "g.gg", "g..g", ".gg."],
  powerOff: [".uu.", "u.uu", "u..u", ".uu."],
  clipboard: [".uu.", "ffff", "fuuf", "ffff", "fuff"],
  helm: [".b.b.", "bbbbb", ".bfb.", "bbbbb", ".b.b."],
  helmTurn: ["b...b", ".bbb.", "bbfbb", ".bbb.", "b...b"],
  whale: ["o.y.g.", "cccccc", "cccccf", ".cccc."],
  bsod: ["uuuuuu", "ubbbbu", "ubfbbu", "uuuuuu", ".uu..."],
  sticker: ["uuuuuuu", "ugcccgu", "uuuuuuu", "uuuuuuu"],
  // idle: party, tired, instruments
  balloons: ["rr.bb", "rr.bb", ".u.u.", "..u.."],
  pinata: ["..u..", "mmm..", "mmmm.", ".m.m."],
  drums: ["y...y", "uuu.u", "uuu.u"],
  trumpet: ["yy...", "yyyyy", "yy..."],
  violin: ["..o.", ".oo.", "oooo", ".oo."],
  sax: ["y...", "y...", "yy.y", "yyyy"],
  xylophone: ["rrrrrr", "yyyyy.", "gggg..", "bbb..."],
  bubbleWand: ["..u", ".u.", "u.."],
  // work: industrial instrumentation and automation
  transmitter: [".bbb.", "bfffb", ".bbb.", "..u..", ".uuu."],
  communicator: ["uu", "uc", "uu"],
  aplSwitchA: ["uuuuuu", "ugugug", "uuuuuu", "..y..."],
  aplSwitchB: ["uuuuuu", "uauaua", "uuuuuu", "..y..."],
  pipe: ["uuuuuuuu", "........", "uuuuuuuu"],
  coriolis: ["u....u", "u....u", "uuuuuu"],
  plcRack: ["uuuuuu", "ugurub", "uuuuuu", "uuuuuu"],
  valveOpen: [".uuu.", "uuuuu", "..u..", "..u..", "yy.yy"],
  valveShut: [".uuu.", "uuuuu", "..u..", "..u..", "yyuyy"],
  calibrator: ["yyyy", "ycfy", "yyyy", "yuuy"],
  scada: ["uuuuuu", "ug.r.u", "u.g.gu", "uuuuuu", "..uu.."],
};

export const IDLE_MORE = {
  // chores
  cooking: (t) => ({ pose: "tool-use", props: [["pan", 12, 4], [["yy"], 13, cyc(t, [3, 1, 0, 1, 3])]], fx: mid(cyc(t, ["sizzle", "", "flip!"], 2)), fxSlot: "orange", caption: "is flipping pancakes" }),
  baking: (t) => ({ pose: "done", props: [["cake", 13, 1], [[cyc(t, ["y", "o"])], 15, 0]], fx: t % 10 < 4 ? mid("♪ hbd") : BLANK, fxSlot: "magenta", caption: "baked a cake" }),
  campfire: (t) => ({ pose: "sleep", props: [[cyc(t, ["fireA", "fireB"]), 13, 2]], fx: cyc(t, [["~", "", ""], [" ~", "~", ""], ["", " ~", ""]], 2), fxSlot: "muted", caption: "is camping by the fire" }),
  ironing: (t) => ({ pose: "tool-use", props: [["ironBoard", 12, 4], ["iron", 12 + cyc(t, [0, 1, 2, 3, 2, 1]), 2]], fx: cyc(t, [mid("≈"), BLANK]), fxSlot: "muted", caption: "is ironing shirts" }),
  dusting: (t) => ({ pose: "walk", props: [["duster", 12 + (t % 3), cyc(t, [0, 1])]], fx: cyc(t, [["*", "", ""], ["", " *", ""], ["", "", "*"]]), fxSlot: "muted", caption: "is dusting the shelves" }),
  trash: (t) => {
    const p = t % 16;
    return { pose: p < 8 ? "walk" : "idle", ox: 1 + Math.min(Math.floor(p / 2), 3), props: [["bin", 15, 2], ...(p < 8 ? [[["uu", "uu"], 13 + Math.min(Math.floor(p / 2), 3), 2]] : [])], fx: p >= 10 ? mid("phew") : BLANK, fxSlot: "muted", caption: "is taking out the trash" };
  },
  mopping: (t) => ({ pose: "walk", props: [["mop", 12 + (t % 3), 1], [cyc(t, [["cc.cc.cc"], [".cc.cc.c"]]), 12, 5]], fx: t % 6 === 5 ? mid("✧") : BLANK, fxSlot: "cyan", caption: "is mopping the floor" }),
  windows: (t) => ({ pose: "tool-use", props: [["window", 13, 0], [["yyyyy"], 13, t % 5]], fx: t % 5 === 4 ? mid("squeak") : BLANK, fxSlot: "cyan", caption: "is cleaning the windows" }),
  // pop culture
  disco: (t) => ({ pose: "hop", props: [[cyc(t, ["discoA", "discoB"]), 13, 0]], fx: cyc(t, [["♪", "", "✦"], ["", "✦ ♪", ""], ["✦", "", "♪"]], 2), fxSlot: "magenta", caption: "is dancing at the disco" }),
  arcade: (t) => ({ pose: "read", props: [[cyc(t, ["arcadeA", "arcadeB"], 2), 13, 0]], fx: t % 12 >= 10 ? mid("1UP") : BLANK, fxSlot: "green", caption: "is beating the high score" }),
  dragonegg: (t) => {
    const p = t % 30;
    const art = p < 12 ? "egg" : p < 20 ? "eggCracked" : "dragon";
    return { pose: p >= 20 ? "done" : "read", props: [[art, 14 + (p < 12 && p % 2 ? 1 : 0), 2]], fx: p >= 12 && p < 16 ? mid("crack!") : p >= 20 ? mid("rawr") : BLANK, fxSlot: "red", caption: p >= 20 ? "hatched a dragon" : "is keeping a dragon egg warm" };
  },
  bluebox: (t) => {
    const p = t % 20;
    const shown = p >= 6 && (p >= 10 || p % 2 === 0);
    return { pose: p >= 10 ? "walk" : "idle", ox: p >= 14 ? Math.min(1 + (p - 14), 6) : 1, hide: p >= 19, props: shown ? [["bluebox", 15, 0]] : [], fx: p >= 6 && p < 10 ? mid("vworp") : BLANK, fxSlot: "blue", caption: "found a blue police box" };
  },
  superhero: (t) => ({ pose: "hop", props: [[cyc(t, ["capeA", "capeB"]), 0, 1]], fx: cyc(t, [mid("up!"), ["↑", "", ""], BLANK]), fxSlot: "red", caption: "is flying like a superhero" }),
  wizard: (t) => ({ pose: "tool-use", props: [["wand", 12, 1]], fx: cyc(t, [["✦", "", ""], ["", "✧ ⋆", ""], ["⋆", "", "✦"]]), fxSlot: "accent", caption: "is casting spells" }),
  zombie: (t) => ({ pose: "walk", ox: 1 + (Math.floor(t / 3) % 4), props: [[["gg"], 11 + (Math.floor(t / 3) % 4), 2]], fx: t % 8 < 4 ? mid("brains") : BLANK, fxSlot: "green", caption: "is doing the zombie walk" }),
  kaiju: (t) => ({ pose: t % 4 < 2 ? "hop" : "blocked", props: [["city", 13 + (t % 2), 3]], fx: t % 8 < 4 ? mid("ROAR") : BLANK, fxSlot: "red", caption: "is stomping the city" }),
  ufo: (t) => {
    const beam = t % 10 >= 5;
    return { pose: beam ? "hop" : "idle", props: [["ufo", 13, 0], ...(beam ? [["beam", 13, 2]] : [])], fx: beam ? mid("beep") : BLANK, fxSlot: "green", caption: "is waving at a UFO" };
  },
  shooter: (t) => ({ pose: "read", props: [["ship", 13, 3], [["y"], 15, 2 - (t % 3)], [["g.g"], 13 + (t % 3), 0]], fx: t % 3 === 0 ? mid("pew") : BLANK, fxSlot: "yellow", caption: "is defending earth from invaders" }),
  // sports
  cycling: (t) => ({ pose: "walk", props: [["bike", 12, 3]], fx: t % 10 === 9 ? mid("ring") : cyc(t, [mid("~"), mid(" ~")]), fxSlot: "muted", caption: "is out cycling" }),
  boxing: (t) => {
    const hit = t % 4 === 1;
    return { pose: "tool-use", props: [["bag", hit ? 14 : 13, 0]], fx: hit ? mid("pow") : BLANK, fxSlot: "red", caption: "is hitting the punching bag" };
  },
  surfing: (t) => ({ pose: "hop", props: [["wave", 14, 2], ["surfboard", 0, 5]], fx: t % 12 < 3 ? mid("radical") : BLANK, fxSlot: "cyan", caption: "is surfing" }),
  golf: (t) => {
    const p = t % 12;
    return { pose: p < 2 ? "tool-use" : "idle", props: [["flag", 17, 1], [["f"], Math.min(12 + p, 17), 5]], fx: p >= 6 && p < 10 ? mid("hole in one") : BLANK, fxSlot: "green", caption: "is playing golf" };
  },
  bowling: (t) => {
    const p = t % 12;
    return { pose: p < 2 ? "tool-use" : p >= 8 ? "done" : "idle", props: [[p >= 7 ? "pinsDown" : "pins", 15, 4], ...(p < 7 ? [[["b"], 12 + p, 5]] : [])], fx: p >= 8 ? mid("strike!") : BLANK, fxSlot: "yellow", caption: "is bowling" };
  },
  volleyball: (t) => {
    const arc = [[12, 3], [13, 1], [14, 0], [15, 0], [16, 1], [17, 3], [16, 1], [15, 0], [14, 0], [13, 1]];
    const [x, y] = cyc(t, arc);
    return { pose: x <= 12 ? "hop" : "idle", props: [["netPole", 15, 2], [["y"], x, y]], fx: x <= 12 ? mid("spike") : BLANK, fxSlot: "yellow", caption: "is playing volleyball" };
  },
  running: (t) => {
    const p = t % 16;
    return { pose: p >= 12 ? "done" : "walk", ox: 1 + Math.min(Math.floor(p / 2), 5), props: [["finish", 18, 1]], fx: p >= 12 ? mid("win!") : BLANK, fxSlot: "yellow", caption: "is running a race" };
  },
  // the rope swings over the head, then under the feet as it hops
  jumprope: (t) => ({
    pose: t % 2 ? "hop" : "idle",
    props: [[t % 2 ? ["o..........o", ".oooooooooo."] : [".oooooooooo.", "o..........o"], 0, t % 2 ? 4 : 0, { slot: "orange" }]],
    fx: mid(String(1 + (Math.floor(t / 2) % 99))),
    fxSlot: "orange",
    caption: "is jumping rope",
  }),
  baseball: (t) => {
    const p = t % 10;
    return { pose: p === 5 ? "tool-use" : "idle", props: [["bat", 11, 1], [["f"], p < 5 ? 18 - p : 12 + p, p < 5 ? 2 : 2 - Math.min(p - 5, 2)]], fx: p >= 5 && p < 9 ? mid(p === 5 ? "crack" : "home run") : BLANK, fxSlot: "yellow", caption: "is batting" };
  },
  archery: (t) => {
    const p = t % 10;
    return { pose: p === 0 ? "tool-use" : "idle", props: [["target", 15, 0], [["uu"], Math.min(12 + p, 15), 2]], fx: p >= 4 ? mid("bullseye") : BLANK, fxSlot: "red", caption: "is practicing archery" };
  },
  climbing: (t) => ({ pose: "hop", props: [["holds", 13, cyc(t, [1, 0])]], fx: t % 8 === 7 ? mid("↑ top") : BLANK, fxSlot: "orange", caption: "is rock climbing" }),
  kite: (t) => ({ pose: "idle", props: [["kite", 14 + cyc(t, [0, 1, 1, 0]), cyc(t, [0, 0, 1, 1])]], fx: cyc(t, [mid("~"), mid(" ~")]), fxSlot: "magenta", caption: "is flying a kite" }),
};

export const WORK_MORE = {
  // requesting
  smoke: (t) => ({ pose: "idle", props: [["smallFire", 13, 3]], fx: cyc(t, [["", "", "o"], ["", " O", ""], ["o", "", ""]]), fxSlot: "muted", caption: "is sending smoke signals" }),
  paperplane: (t) => ({ pose: t % 8 === 0 ? "tool-use" : "idle", props: [["plane", 11 + (t % 8), 2 - Math.floor((t % 8) / 3)]], fx: t % 8 >= 4 ? mid("whoosh") : BLANK, fxSlot: "fg", caption: "is throwing a paper airplane" }),
  walkie: (t) => ({ pose: "chew", props: [["walkie", 12, 1]], fx: mid(cyc(t, ["kshh", "over", ""], 2)), fxSlot: "muted", caption: "is on the walkie-talkie" }),
  lighthouse: (t) => ({ pose: "idle", props: [["lighthouse", 14, 0]], fx: cyc(t, [["—=", "", ""], ["", "", ""], ["=—", "", ""]]), fxSlot: "yellow", caption: "is lighting the lighthouse" }),
  beacon: (t) => ({ pose: "read", props: [["beacon", 14, 1]], fx: t % 6 < 3 ? mid("!") : BLANK, fxSlot: "orange", caption: "is lighting the beacons" }),
  // thinking
  abacus: (t) => ({ pose: "thinking", props: [[cyc(t, ["abacusA", "abacusB"], 2), 12, 2]], fx: t % 8 === 7 ? mid("= 42") : BLANK, fxSlot: "yellow", caption: "is counting on the abacus" }),
  puzzle: (t) => {
    const done = t % 12 >= 8;
    return { pose: done ? "done" : "thinking", props: [[done ? "puzzleTogether" : "puzzleApart", 14, 2]], fx: done ? mid("fits!") : BLANK, fxSlot: "green", caption: "is solving a puzzle" };
  },
  map: (t) => {
    const route = [[1, 1], [2, 1], [2, 2], [3, 2], [4, 2]];
    const steps = route.slice(0, 1 + (t % route.length));
    return { pose: "read", props: [["map", 13, 1], ...steps.map(([x, y]) => [["r"], 13 + x, 1 + y])], fx: BLANK, fxSlot: "red", caption: "is reading the map" };
  },
  compass: (t) => ({ pose: "thinking", props: [[cyc(t, ["compassA", "compassB", "compassC"]), 14, 1]], fx: mid(cyc(t, ["N", "E", "S", "W"], 2)), fxSlot: "red", caption: "is finding the way" }),
  hourglass: (t) => ({ pose: "thinking", props: [[cyc(t, ["hourTop", "hourBottom"], 4), 14, 0]], fx: BLANK, fxSlot: "yellow", caption: "is waiting for the sand" }),
  maze: (t) => {
    const path = [[1, 1], [2, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3], [4, 2], [4, 1]];
    const [x, y] = cyc(t, path);
    return { pose: "thinking", props: [["maze", 13, 0], [["r"], 13 + x, y]], fx: BLANK, fxSlot: "red", caption: "is solving the maze" };
  },
  sudoku: (t) => ({ pose: "thinking", props: [[fill(["fufuf", "ufufu", "fufuf"], 0, "g").map((r, i) => (i <= (t % 6) / 2 ? r.replace(/u/g, "g") : r)), 14, 2]], fx: t % 6 === 5 ? mid("✓") : BLANK, fxSlot: "green", caption: "is doing sudoku" }),
  math: (t) => ({ pose: "thinking", fx: [cyc(t, ["∑", "π", "√x", "∫"], 2), cyc(t, [" ∫", " ∑", " π", " √x"], 2), cyc(t, ["π", "√x", "∫", "∑"], 2)], fxSlot: "accent", caption: "is doing the math" }),
  // tools
  bricks: (t) => {
    const n = 1 + (Math.floor(t / 3) % 4);
    const wall = Array.from({ length: n }, (_, i) => (i % 2 ? ".rr.rr" : "rr.rr."));
    return { pose: "tool-use", props: [[wall, 13, 6 - n]], fx: BLANK, fxSlot: "red", caption: "is laying bricks" };
  },
  screwdriver: (t) => ({ pose: "tool-use", props: [["screwdriver", 13, cyc(t, [0, 1])], [["u"], 13, 5]], fx: t % 4 === 3 ? mid("click") : BLANK, fxSlot: "yellow", caption: "is tightening screws" }),
  solder: (t) => ({ pose: "tool-use", props: [["circuit", 12, 3], ["solderIron", 13 + (t % 3), 0]], fx: cyc(t, [["~", "", ""], ["", "~", ""]]), fxSlot: "muted", caption: "is soldering a circuit" }),
  sewing: (t) => ({ pose: "read", props: [["sewing", 13, 2], [["m".repeat(1 + (t % 5))], 12, 5]], fx: mid(cyc(t, ["tk", "tk tk"])), fxSlot: "magenta", caption: "is sewing" }),
  crane: (t) => ({ pose: "idle", props: [["crane", 13, 0], [["oo"], 17, 1 + cyc(t, [0, 1, 2, 3, 2, 1])]], fx: BLANK, fxSlot: "orange", caption: "is operating the crane" }),
  printer3d: (t) => {
    const h = Math.floor((t % 12) / 4);
    return { pose: "read", props: [["frame3d", 13, 1], ...(h ? [[Array.from({ length: h }, () => "ccc"), 14, 4 - h]] : [])], fx: mid(cyc(t, ["bzz", "bzzz"])), fxSlot: "cyan", caption: "is 3D printing" };
  },
  anvil: (t) => {
    const down = t % 2 === 1;
    return { pose: "tool-use", props: [["anvil", 13, 3], [down ? "hammerDown" : "hammerUp", 12, 0]], fx: down ? mid("clang") : BLANK, fxSlot: "orange", caption: "is forging a sword" };
  },
  conveyor: (t) => ({ pose: "idle", props: [["belt", 12, 5], [["oo"], 12 + (t % 6), 4], [["oo"], 12 + ((t + 3) % 6), 4]], fx: mid("→"), fxSlot: "orange", caption: "is running the conveyor belt" }),
  excavator: (t) => ({ pose: "read", props: [["digger", 13, cyc(t, [0, 1, 2, 1])], [["oooo"], 13, 5]], fx: BLANK, fxSlot: "orange", caption: "is digging" }),
  // responding
  stamp: (t) => {
    const down = t % 4 >= 2;
    return { pose: "tool-use", props: [["paper", 13, 4], ["stamp", 14, down ? 1 : 0]], fx: down ? mid("approved") : BLANK, fxSlot: "red", caption: "is stamping documents" };
  },
  graffiti: (t) => {
    const n = Math.floor((t % 21) / 3);
    const colors = "rmybgca";
    const wall = ["uuuuuuu", "u.....u", "u.....u", "uuuuuuu"].map((r, y) =>
      y === 0 || y === 3 ? r : r.split("").map((c, x) => (x > 0 && x <= n && x < 6 ? colors[(x + y) % colors.length] : c)).join(""),
    );
    return { pose: "tool-use", props: [[wall, 12, 1]], fx: mid(t % 3 === 0 ? "pssh" : ""), fxSlot: "magenta", caption: "is painting graffiti" };
  },
  clapper: (t) => ({ pose: "tool-use", props: [[t % 6 < 3 ? "clapOpen" : "clapShut", 14, 1]], fx: t % 6 === 3 ? mid("action!") : BLANK, fxSlot: "yellow", caption: "is shooting a movie" }),
  neon: (t) => ({ pose: "idle", props: [[t % 7 === 3 ? "neonOff" : "neonOn", 13, 1]], fx: t % 7 === 3 ? BLANK : mid("OPEN"), fxSlot: "magenta", caption: "is lighting a neon sign" }),
  fax: (t) => ({ pose: "idle", props: [["fax", 13, 2], ...(t % 6 >= 3 ? [[["ff", "ff"], 14, 4]] : [])], fx: t % 6 === 2 ? mid("beep") : BLANK, fxSlot: "muted", caption: "is faxing the answer" }),
  notebook: (t) => {
    const n = 1 + (Math.floor(t / 3) % 3);
    const page = ["ffffff", ...Array.from({ length: 3 }, (_, i) => (i < n ? "fbbbbf" : "ffffff"))];
    return { pose: "read", props: [[page, 13, 1]], fx: BLANK, fxSlot: "blue", caption: "is taking notes" };
  },
  postits: (t) => {
    const spots = [[12, 0], [15, 0], [18, 0], [12, 3], [15, 3], [18, 3]];
    const n = 1 + (Math.floor(t / 2) % spots.length);
    return { pose: "tool-use", props: spots.slice(0, n).map(([x, y], i) => [[i % 2 ? "mm" : "yy", i % 2 ? "mm" : "yy"], x, y]), fx: BLANK, fxSlot: "yellow", caption: "is sticking post-it notes" };
  },
  origami: (t) => ({ pose: "read", props: [[t % 8 < 4 ? "craneFlat" : "craneFolded", 14, 2]], fx: t % 8 >= 4 ? mid("✧") : BLANK, fxSlot: "fg", caption: "is folding origami" }),
};

// Memes and IT life, mixed into every mode's pool.
export const WORK_MEMES = {
  thisisfine: (t) => ({ pose: "chew", props: [["flames", 11, 3], ["mug", 13, cyc(t, [0, 0, 1])]], fx: mid(cyc(t, ["this", "is", "fine."], 3)), fxSlot: "orange", caption: "says this is fine" }),
  womm: (t) => ({ pose: t % 10 >= 8 ? "done" : "read", props: [["sticker", 12, 2]], fx: t % 10 >= 8 ? mid("WOMM ✓") : BLANK, fxSlot: "green", caption: "says it works on my machine" }),
  friday: (t) => ({ pose: t % 8 < 4 ? "blocked" : "idle", props: [["calendar", 12, 1], ["rocket", 17, cyc(t, [2, 1, 0, 1])]], fx: mid(cyc(t, ["FRI", "5pm", "yolo"], 3)), fxSlot: "red", caption: "is deploying on a Friday" }),
  rmrf: (t) => {
    const oops = t % 12 >= 7;
    return { pose: oops ? "blocked" : "responding", props: [["terminal", 12, 1]], fx: mid(oops ? "oops" : "rm -rf"), fxSlot: oops ? "red" : "green", caption: oops ? "ran rm -rf in the wrong folder" : "is cleaning up files" };
  },
  offon: (t) => {
    const on = t % 8 >= 4;
    return { pose: on ? "done" : "sleep", props: [[on ? "powerOn" : "powerOff", 14, 1]], fx: mid(on ? "on" : "off"), fxSlot: on ? "green" : "muted", caption: "turned it off and on again" };
  },
  forcepush: (t) => ({ pose: "tool-use", ox: 1 + cyc(t, [0, 1, 2, 1]), props: [["box", 14 + cyc(t, [0, 1, 2, 1]), 2]], fx: mid(cyc(t, ["git push", "--force", "!!"], 3)), fxSlot: "red", caption: "is force pushing to main" }),
  copypaste: (t) => ({ pose: "read", props: [["clipboard", 13, 1]], fx: mid(cyc(t, ["ctrl+c", "ctrl+v"], 3)), fxSlot: "orange", caption: "is copying from stack overflow" }),
  merge: (t) => {
    const p = t % 8;
    return { pose: p >= 6 ? "blocked" : "thinking", props: [[["rr", "rr"], 11 + Math.min(p, 3), 2], [["gg", "gg"], 18 - Math.min(p, 3), 2]], fx: p >= 4 ? ["<<<<", "====", ">>>>"] : BLANK, fxSlot: "yellow", caption: "is resolving a merge conflict" };
  },
  notfound: (t) => ({ pose: "thinking", fx: [cyc(t, ["4", "40", "404"], 2), "", t % 6 >= 3 ? " ?" : ""], fxSlot: "red", caption: "can't find the page" }),
  kubernetes: (t) => ({ pose: "tool-use", props: [[cyc(t, ["helm", "helmTurn"], 2), 14, 0]], fx: mid("k8s"), fxSlot: "blue", caption: "is steering the cluster" }),
  docker: (t) => ({ pose: "hop", props: [["whale", 13, cyc(t, [2, 2, 1])]], fx: cyc(t, [["~", "", ""], ["", "~", ""]], 2), fxSlot: "cyan", caption: "is shipping containers" }),
  vim: (t) => ({ pose: t % 10 >= 8 ? "blocked" : "thinking", fx: mid(cyc(t, [":q", ":wq", ":q!", "esc", "help"], 2)), fxSlot: "green", caption: "is trying to exit vim" }),
  tabs: (t) => ({ pose: t % 4 < 2 ? "blocked" : "idle", fx: ["tabs", " vs", "spaces"], fxSlot: cyc(t, ["orange", "cyan"], 2), caption: "is arguing tabs vs spaces" }),
  bsod: (t) => ({ pose: "blocked", props: [["bsod", 13, 0]], fx: mid(t % 6 < 3 ? ":(" : ""), fxSlot: "blue", caption: "got a blue screen" }),
  npm: (t) => {
    const n = 1 + (Math.floor(t / 2) % 6);
    const tower = Array.from({ length: n }, (_, i) => (i % 2 ? "oooo" : "yyyy"));
    return { pose: n >= 5 ? "blocked" : "tool-use", props: [[tower, 14 + (n >= 5 ? t % 2 : 0), 6 - n]], fx: mid(n >= 5 ? "1.2 GB" : "npm i"), fxSlot: "red", caption: "is installing node_modules" };
  },
};

// A party, getting tired, and more instruments.
export const IDLE_PARTY = {
  party: (t) => ({ pose: "hop", props: [["balloons", 13, cyc(t, [0, 1])]], fx: cyc(t, [["✦", " *", "✧"], ["*", "✧", " ✦"], [" ✧", "✦", "*"]]), fxSlot: cyc(t, ["magenta", "yellow", "cyan"]), caption: "is throwing a party" }),
  pinata: (t) => {
    const hit = t % 6 === 3;
    return { pose: hit ? "tool-use" : "idle", props: [["pinata", 14 + cyc(t, [0, 1, 0, -1]), 0]], fx: hit ? mid("whack") : t % 12 > 8 ? ["★", " ★", "★"] : BLANK, fxSlot: "yellow", caption: "is hitting a piñata" };
  },
  yawn: (t) => {
    const p = t % 16;
    return { pose: p < 6 ? "idle" : p < 10 ? "chew" : "sleep", fx: p >= 6 && p < 10 ? mid("yaawn") : p >= 10 ? rising(["z", "z"], t) : BLANK, fxSlot: "muted", caption: "is getting tired" };
  },
  stretch: (t) => ({ pose: t % 4 < 2 ? "hop" : "chew", fx: t % 8 < 4 ? mid("*stretch*") : BLANK, fxSlot: "fg", caption: "is stretching" }),
  drums: (t) => ({ pose: "tool-use", props: [["drums", 13, 2]], fx: mid(cyc(t, ["ba", "dum", "tss"], 2)), fxSlot: "yellow", caption: "is playing the drums" }),
  trumpet: (t) => ({ pose: t % 4 < 2 ? "chew" : "hop", props: [["trumpet", 11, 2]], fx: cyc(t, [mid("toot"), ["♪", "", ""], ["", " ♫", ""]]), fxSlot: "yellow", caption: "is playing the trumpet" }),
  violin: (t) => ({ pose: "read", props: [["violin", 12, 1], [["uuu"], 12 + (t % 3), 0]], fx: cyc(t, [["♫", "", ""], ["", "♪", ""]], 2), fxSlot: "orange", caption: "is playing the violin" }),
  sax: (t) => ({ pose: t % 4 < 2 ? "chew" : "idle", props: [["sax", 12, 2]], fx: cyc(t, [["♪", "", ""], [" ♪♪", "", ""], ["", "♫", ""]]), fxSlot: "yellow", caption: "is playing a sax solo" }),
  xylophone: (t) => ({ pose: "tool-use", props: [["xylophone", 12, 2, { light: t % 6 }]], fx: mid(cyc(t, ["ding", "dong", "ding"])), fxSlot: "cyan", caption: "is playing the xylophone" }),
  bubbles: (t) => ({ pose: t % 6 < 3 ? "chew" : "idle", props: [["bubbleWand", 11, 1]], fx: rising(["o", "O", "°"], t, 2), fxSlot: "cyan", caption: "is blowing bubbles" }),
};

// Industrial instrumentation and automation, mixed into the work pools.
export const WORK_INDUSTRIAL = {
  hart: (t) => ({ pose: "read", props: [["transmitter", 15, 0], ["communicator", 12, 2]], fx: mid(cyc(t, ["HART", "∿∿∿", "4-20"], 2)), fxSlot: "blue", caption: "is talking HART to a transmitter" }),
  apl: (t) => ({ pose: "tool-use", props: [[cyc(t, ["aplSwitchA", "aplSwitchB"]), 13, 1]], fx: mid(cyc(t, ["APL", "10Mb", "2-wire"], 2)), fxSlot: "green", caption: "is wiring Ethernet-APL" }),
  radarLevel: (t) => {
    const level = 1 + (Math.floor(t / 3) % 4);
    const tank = ["u.bb.u", ...Array.from({ length: 4 }, (_, i) => (4 - i <= level ? "uccccu" : "u....u")), "uuuuuu"];
    return { pose: "read", props: [[tank, 13, 0]], fx: mid(`▼ ${level * 25}%`), fxSlot: "cyan", caption: "is reading a radar level gauge" };
  },
  pressure: (t) => ({ pose: "thinking", props: [["pipe", 12, 3], ["transmitter", 13, 0]], fx: mid(`${(4 + (t % 5) * 0.1).toFixed(1)} bar`), fxSlot: "blue", caption: "is checking a pressure transmitter" }),
  coriolis: (t) => {
    const path = [[0, 0], [0, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 1], [5, 0]];
    const [x, y] = cyc(t, path);
    return { pose: "read", props: [["coriolis", 13, 1], [["c"], 13 + x, 1 + y]], fx: mid("kg/h"), fxSlot: "cyan", caption: "is measuring flow with a Coriolis meter" };
  },
  plc: (t) => ({ pose: "responding", props: [["plcRack", 13, 1, { light: t % 6 }]], fx: mid(cyc(t, ["-[ ]-", "-[/]-", "-( )-"], 2)), fxSlot: "green", caption: "is programming the PLC" }),
  valve: (t) => {
    const open = t % 8 < 4;
    return { pose: "tool-use", props: [[open ? "valveOpen" : "valveShut", 14, 1]], fx: mid(open ? "OPEN 80%" : "20%"), fxSlot: "yellow", caption: "is stroking a control valve" };
  },
  pid: (t) => ({ pose: "thinking", fx: [cyc(t, ["SP ───", "SP ───"]), cyc(t, ["PV ╱╲╱", "PV ╲╱─", "PV ───"], 3), cyc(t, ["Kp Ti", "Kp Ti Td"], 4)], fxSlot: "accent", caption: "is tuning a PID loop" }),
  calibrator: (t) => ({ pose: "read", props: [["calibrator", 13, 1]], fx: mid(cyc(t, ["4.00 mA", "12.00 mA", "20.00 mA"], 3)), fxSlot: "yellow", caption: "is calibrating a 4-20 mA loop" }),
  scada: (t) => {
    const alarm = t % 10 >= 7;
    return { pose: alarm ? "blocked" : "read", props: [["scada", 13, 0]], fx: alarm ? mid("ALM!") : BLANK, fxSlot: "red", caption: alarm ? "acknowledges a SCADA alarm" : "is watching the SCADA screen" };
  },
};

export const POOLS_MORE = {
  requesting: ["smoke", "paperplane", "walkie", "lighthouse", "beacon", "friday", "offon", "thisisfine", "hart", "apl"],
  thinking: ["abacus", "puzzle", "map", "compass", "hourglass", "maze", "sudoku", "math", "vim", "tabs", "notfound", "merge", "pid", "scada", "pressure"],
  tool: ["bricks", "screwdriver", "solder", "sewing", "crane", "printer3d", "anvil", "conveyor", "excavator", "rmrf", "docker", "kubernetes", "npm", "forcepush", "bsod", "valve", "calibrator", "plc"],
  responding: ["stamp", "graffiti", "clapper", "neon", "fax", "notebook", "postits", "origami", "copypaste", "womm", "radarLevel", "coriolis"],
};
