"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var testing_1 = require("claude-code/testing");
var rules_1 = require("./rules");
(0, testing_1.test)('the sentence is one line, without quote markers', function () {
    (0, testing_1.expect)((0, rules_1.sentenceOf)('\n> PR #146 merged as 5fd98a4;\n> next is #132.\n')).toBe('PR #146 merged as 5fd98a4; next is #132.');
});
(0, testing_1.test)('a sentence never starts with the bash-mode prefix', function () {
    (0, testing_1.expect)((0, rules_1.sentenceOf)('!2376 merged as d655cdd004.')).toBe('MR !2376 merged as d655cdd004.');
    (0, testing_1.expect)((0, rules_1.sentenceOf)('> !2376 merged.')).toBe('MR !2376 merged.');
    (0, testing_1.expect)((0, rules_1.sentenceOf)('MR !2376 merged.')).toBe('MR !2376 merged.');
});
(0, testing_1.test)('a handover is offered for two weeks', function () {
    (0, testing_1.expect)((0, rules_1.isFresh)({ text: 'x', at: 0, root: '/r' }, rules_1.MAX_AGE_MS - 1)).toBe(true);
    (0, testing_1.expect)((0, rules_1.isFresh)({ text: 'x', at: 0, root: '/r' }, rules_1.MAX_AGE_MS)).toBe(false);
    (0, testing_1.expect)((0, rules_1.isFresh)({ text: '', at: 0, root: '/r' }, 1)).toBe(false);
    (0, testing_1.expect)((0, rules_1.isFresh)(undefined, 1)).toBe(false);
});
(0, testing_1.test)('paths and keys are per session', function () {
    (0, testing_1.expect)((0, rules_1.handoverPath)('/home/me')).toBe('/home/me/.claude/handover.md');
    (0, testing_1.expect)((0, rules_1.sessionPath)('/home/me', 's1')).toBe('/home/me/.claude/handovers/s1.md');
    (0, testing_1.expect)((0, rules_1.storeKey)('s1')).toBe('handover:s1');
    (0, testing_1.expect)((0, rules_1.sessionIdOf)('handover:s1')).toBe('s1');
    (0, testing_1.expect)((0, rules_1.sessionIdOf)('other')).toBeNull();
});
(0, testing_1.test)('the choices are this root\'s fresh sentences, newest first', function () {
    var entry = function (key, at, root) {
        if (root === void 0) { root = '/r/repo'; }
        return ({ key: key, handover: { text: key, at: at, root: root } });
    };
    var entries = [entry('a', 10), entry('b', 30), entry('c', 20, '/r/other'), entry('d', -rules_1.MAX_AGE_MS)];
    (0, testing_1.expect)((0, rules_1.choicesFor)(entries, '/r/repo', 40).map(function (e) { return e.key; })).toEqual(['b', 'a']);
});
