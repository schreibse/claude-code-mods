"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_AGE_MS = void 0;
exports.handoverPath = handoverPath;
exports.sessionPath = sessionPath;
exports.storeKey = storeKey;
exports.sessionIdOf = sessionIdOf;
exports.isFresh = isFresh;
exports.choicesFor = choicesFor;
exports.sentenceOf = sentenceOf;
exports.MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
var KEY_PREFIX = 'handover:';
// The path the skill writes; each session's sentence then lands in a file of its own.
function handoverPath(home) {
    return "".concat(home, "/.claude/handover.md");
}
function sessionPath(home, sessionId) {
    return "".concat(home, "/.claude/handovers/").concat(sessionId, ".md");
}
function storeKey(sessionId) {
    return "".concat(KEY_PREFIX).concat(sessionId);
}
function sessionIdOf(key) {
    return key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : null;
}
// A sentence from another day may describe work since redone; two weeks is the cut.
function isFresh(handover, now) {
    return handover !== undefined && handover.text !== '' && now - handover.at < exports.MAX_AGE_MS;
}
function choicesFor(entries, root, now) {
    return entries
        .filter(function (_a) {
        var handover = _a.handover;
        return isFresh(handover, now) && handover.root === root;
    })
        .sort(function (a, b) { return b.handover.at - a.handover.at; });
}
// The skill writes the sentence alone; a quote marker or surrounding blank lines are not part of it.
// A leading `!` (a GitLab MR ref) would send the pasted prompt to bash, so it gets a word in front.
function sentenceOf(content) {
    var sentence = content.trim().replace(/^>\s?/gm, '').replace(/\s*\n\s*/g, ' ');
    return sentence.startsWith('!') ? "MR ".concat(sentence) : sentence;
}
