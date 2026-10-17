// GENERATED from shared/scenes-cheer.mjs by scripts/sync-shared.mjs. Edit the original.
// Cheer scenes for scenes.mjs: 36 scenes that play while you type a prompt,
// the monster rooting for you (pom-poms, fireworks, a trophy, a high five…).
// Same shape as the scenes there: each is a function of the frame returning
// { pose, ox, props, fx, fxSlot, caption }.
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

export const ART_CHEER = {
  pompomA: ["m.m.", ".mm.", "m.m.", "..u."],
  pompomB: [".m.m", ".mm.", ".m.m", ".u.."],
  foamFinger: [".y..", ".y..", "yyyy", "yyyy", ".yy."],
  goSign: ["gggggg", "gfgfgg", "gggggg", "..u...", "..u..."],
  trophy: ["yyyyyy", "yyyyyy", ".yyyy.", "..yy..", ".oooo."],
  medal: ["r..r", ".rr.", ".yy.", "yyyy", ".yy."],
  heartBig: [".rr.rr", "rrrrrr", ".rrrr.", "..rr.."],
  heartSmall: ["r.r", "rrr", ".r."],
  thumb: ["..y.", "..y.", "yyyy", "yyyy", "yyy."],
  starA: ["..y..", "yyyyy", ".yyy.", "y...y"],
  starB: ["..a..", "aaaaa", ".aaa.", "a...a"],
  crown: ["y.y.y", "yyyyy", "yryby"],
  flagA: ["rrrr", "rrrr", "u...", "u...", "u...", "u..."],
  flagB: ["rrr.", "rrrr", "u.r.", "u...", "u...", "u..."],
  banner: ["uuuuuuu", "mmmmmmm", ".mmmmm."],
  scoreboard: ["uuuuuu", "ugugu.", "uuuuuu", "..u..."],
  finishFlag: ["fufu", "ufuf", "u..u", "u..u", "u..u", "u..u"],
  cheerCake: ["..y...", "..f...", "mmmmmm", "ffffff", "mmmmmm"],
  giftShut: ["..r..", "ooroo", "ooroo", "ooroo"],
  giftOpen: ["r...r", ".....", "ooroo", "ooroo"],
  bouquet: ["r.m.y", ".rmy.", "..g..", ".ggg.", "..g.."],
  sunA: ["y.y.y", ".yyy.", "yyyyy", ".yyy.", "y.y.y"],
  sunB: ["..y..", "yyyyy", ".yyy.", "yyyyy", "..y.."],
  rainbow: [".rrrr.", "ryyyyr", "yg..gy", "g....g"],
  glowA: ["g.", "g.", ".u"],
  glowB: [".g", ".g", "u."],
  bell: ["..u..", ".yyy.", ".yyy.", "yyyyy", "..y.."],
  gong: [".uuu.", "uyyyu", "uyyyu", ".uuu.", "u...u"],
  hand: ["f.f.f", "fffff", "fffff", ".fff."],
  sparkler: ["y", "u", "u", "u", "u"],
  ovation: ["f...f..f", "f.f.f..f", "uuuuuuuu"],
};

const confetti = (t, n = 6) =>
  Array.from({ length: n }, (_, i) => [[["r", "y", "g", "b", "m", "c"][i]], 11 + ((i * 3 + t) % 9), (i + t) % 6]);

export const CHEER = {
  pompoms: (t) => ({ pose: "hop", props: [[cyc(t, ["pompomA", "pompomB"]), 13, 0]], fx: mid(cyc(t, ["go!", "go go!", "GO!"], 2)), fxSlot: "magenta", caption: "is cheering you on" }),
  foamFinger: (t) => ({ pose: t % 4 < 2 ? "hop" : "idle", props: [["foamFinger", 13, cyc(t, [0, 1])]], fx: mid("#1"), fxSlot: "yellow", caption: "says you're number one" }),
  goSign: (t) => ({ pose: "hop", props: [["goSign", 13, cyc(t, [0, 1], 2)]], fx: mid(cyc(t, ["GO", "GO GO", ""], 2)), fxSlot: "green", caption: "holds up a GO! sign" }),
  theWave: (t) => ({ pose: cyc(t, ["idle", "hop", "hop", "idle"]), fx: mid(cyc(t, ["\\o/", " o ", "\\o/", "/o\\"])), fxSlot: "accent", caption: "is doing the wave" }),
  clapping: (t) => ({ pose: t % 2 ? "chew" : "hop", fx: cyc(t, [mid("clap"), ["clap", "", " clap"], BLANK]), fxSlot: "yellow", caption: "is clapping for you" }),
  trophy: (t) => ({ pose: "done", props: [["trophy", 13, 1]], fx: t % 6 < 3 ? ["✦", "", " ✧"] : [" ✧", "✦", ""], fxSlot: "yellow", caption: "has a trophy ready for you" }),
  medal: (t) => ({ pose: t % 8 < 4 ? "chew" : "done", props: [["medal", 13, 1]], fx: t % 8 < 4 ? mid("*shine*") : BLANK, fxSlot: "yellow", caption: "is polishing your medal" }),
  confetti: (t) => ({ pose: "hop", props: confetti(t), fx: mid(cyc(t, ["yay!", "woo!"], 3)), fxSlot: "magenta", caption: "throws confetti for you" }),
  fireworks: (t) => {
    const p = t % 12;
    const burst = p < 4 ? [[["y"], 15, 5 - p]] : p < 8 ? [["starA", 13, 0]] : [["starB", 13, 0]];
    return { pose: p < 4 ? "idle" : "done", props: burst, fx: p >= 4 && p < 6 ? mid("BOOM") : BLANK, fxSlot: "red", caption: "lights fireworks for your idea" };
  },
  drumroll: (t) => ({ pose: "tool-use", props: [["drums", 13, 2]], fx: mid(cyc(t, ["brrr", "brrrr", "brrrrr"])), fxSlot: "yellow", caption: "plays a drumroll for your prompt" }),
  hype: (t) => ({ pose: "responding", props: [["megaphone", 12, 1]], fx: cyc(t, [mid("YOU"), mid("GOT"), mid("THIS!")], 2), fxSlot: "orange", caption: "hypes you up" }),
  love: (t) => ({ pose: "chew", props: [[t % 4 < 2 ? "heartBig" : "heartSmall", t % 4 < 2 ? 13 : 14, 1]], fx: rising(["♥", "♥", "♥"], t, 2), fxSlot: "red", caption: "sends you love" }),
  thumbsUp: (t) => ({ pose: "done", props: [["thumb", 13, cyc(t, [1, 0, 1, 1])]], fx: mid(cyc(t, ["nice", "nice!"], 3)), fxSlot: "green", caption: "gives you a thumbs up" }),
  superstar: (t) => ({ pose: "hop", props: [[cyc(t, ["starA", "starB"], 2), 13, 1]], fx: cyc(t, [["✦", "", ""], ["", " ✧", ""], ["", "", "✦"]]), fxSlot: "yellow", caption: "thinks you're a star" }),
  moonshot: (t) => {
    const y = 5 - (t % 9);
    return { pose: "done", props: y > -5 ? [["rocket", 14, y]] : [], fx: y < 0 ? mid("to the moon") : mid("3.. 2.."), fxSlot: "cyan", caption: "launches your idea" };
  },
  crown: (t) => ({ pose: "done", props: [["crown", 4, cyc(t, [0, 0, 0, 1])]], fx: t % 6 < 3 ? mid("✧") : BLANK, fxSlot: "yellow", caption: "crowns you prompt royalty" }),
  flag: (t) => ({ pose: "hop", props: [[cyc(t, ["flagA", "flagB"]), 14, 0]], fx: BLANK, fxSlot: "red", caption: "waves your flag" }),
  banner: (t) => ({ pose: "idle", props: [["banner", 12, 0]], fx: mid(cyc(t, ["YAY", "YAAAY"], 3)), fxSlot: "magenta", caption: "hangs up a banner for you" }),
  scoreboard: (t) => ({ pose: t % 10 >= 7 ? "done" : "read", props: [["scoreboard", 13, 1]], fx: mid(`${Math.min(10, 1 + (t % 10))}/10`), fxSlot: "green", caption: "scores your prompt 10/10" }),
  finishLine: (t) => {
    const ox = Math.min(5, Math.floor((t % 16) / 2));
    return { pose: ox < 5 ? "walk" : "done", ox: 1 + ox, props: [["finishFlag", 16, 0]], fx: ox >= 5 ? mid("WIN") : BLANK, fxSlot: "green", caption: "races you to the finish line" };
  },
  torch: (t) => ({ pose: "walk", ox: 1 + (Math.floor(t / 2) % 3), props: [["torch", 14 + (Math.floor(t / 2) % 3), 2], [[cyc(t, ["o", "r", "y"])], 14 + (Math.floor(t / 2) % 3), 1]], fx: BLANK, fxSlot: "orange", caption: "carries the torch for you" }),
  cake: (t) => ({ pose: t % 8 < 4 ? "chew" : "done", props: [["cheerCake", 13, 1]], fx: cyc(t, [mid("ta-da"), BLANK], 4), fxSlot: "magenta", caption: "baked you a cake" }),
  gift: (t) => {
    const open = t % 12 >= 6;
    return { pose: open ? "done" : "idle", props: [[open ? "giftOpen" : "giftShut", 13, 2]], fx: open ? mid("for u!") : BLANK, fxSlot: "red", caption: "has a gift for your idea" };
  },
  bouquet: (t) => ({ pose: t % 6 < 3 ? "chew" : "idle", props: [["bouquet", 13, 1]], fx: t % 6 < 3 ? mid("❀") : BLANK, fxSlot: "magenta", caption: "brings you flowers" }),
  sunshine: (t) => ({ pose: "done", props: [[cyc(t, ["sunA", "sunB"], 2), 14, 0]], fx: mid("☀"), fxSlot: "yellow", caption: "brings the sunshine" }),
  rainbow: (t) => ({ pose: "hop", props: [["rainbow", 13, 1]], fx: t % 6 < 3 ? mid("✧") : BLANK, fxSlot: "accent", caption: "paints you a rainbow" }),
  glowStick: (t) => ({ pose: "hop", props: [[cyc(t, ["glowA", "glowB"]), 14, 1], [cyc(t + 1, ["glowA", "glowB"]), 17, 2]], fx: mid(cyc(t, ["♪", "♫"], 2)), fxSlot: "green", caption: "waves a glow stick" }),
  bell: (t) => ({ pose: "tool-use", props: [["bell", 13 + cyc(t, [0, 1, 0, -1]), 0]], fx: mid(cyc(t, ["ding", "ding ding"], 2)), fxSlot: "yellow", caption: "rings the bell for you" }),
  gong: (t) => {
    const hit = t % 8 === 4;
    return { pose: hit ? "tool-use" : "idle", props: [["gong", 13, 0]], fx: hit || t % 8 === 5 ? mid("GONNG") : BLANK, fxSlot: "orange", caption: "hits the gong" };
  },
  highFive: (t) => {
    const p = t % 10;
    return { pose: p >= 6 ? "done" : "idle", props: [["hand", 19 - Math.min(p, 6), 1]], fx: p >= 6 ? mid("high five!") : BLANK, fxSlot: "yellow", caption: "goes for a high five" };
  },
  happyDance: (t) => ({ pose: "hop", ox: 1 + cyc(t, [0, 1, 2, 1, 0, 1, 2, 3]), fx: cyc(t, [["♪", "", " ♫"], ["", "♫", ""], [" ♪", "", "♪"]], 2), fxSlot: "magenta", caption: "does a happy dance" }),
  sparkler: (t) => ({ pose: "done", props: [["sparkler", 13, 1], [[cyc(t, ["y", "o", "f"])], 13, 0], [[cyc(t + 1, ["y", "o", "f"])], 12 + (t % 3), 0]], fx: cyc(t, [["*", " ·", ""], [" ·", "*", ""], ["", " *", "·"]]), fxSlot: "yellow", caption: "lights a sparkler" }),
  levelUp: (t) => {
    const xp = Math.min(6, t % 10);
    return { pose: xp >= 6 ? "done" : "idle", fx: ["", `${"▰".repeat(xp)}${"▱".repeat(6 - xp)}`, xp >= 6 ? "LVL UP!" : "+xp"], fxSlot: "green", caption: "says your prompt levels you up" };
  },
  coinShower: (t) => ({ pose: "hop", props: [0, 1, 2, 3].map((i) => ["coin", 12 + i * 2, (t + i * 2) % 6]), fx: mid("+$$$"), fxSlot: "yellow", caption: "showers you in coins" }),
  kudos: (t) => ({ pose: "done", fx: rising(["+1", "+1", "+1"], t, 2), fxSlot: "accent", caption: "gives you kudos" }),
  ovation: (t) => ({ pose: t % 4 < 2 ? "hop" : "done", props: [["ovation", 12, t % 4 < 2 ? 3 : 2]], fx: mid(cyc(t, ["bravo!", "encore!"], 4)), fxSlot: "orange", caption: "gives you a standing ovation" }),
};
