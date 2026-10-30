"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var testing_1 = require("claude-code/testing");
var rules_1 = require("./rules");
var reported = [
    { file: 'src/a.ts', line: 3, summary: 'Null check missing on the parsed id', short_summary: 'Null check missing', failure_scenario: 'x', category: 'correctness' },
    { file: 'src/b.ts', summary: 'Query runs per row', failure_scenario: 'y' },
];
(0, testing_1.test)('a report without outcomes starts a walk, one with outcomes ends it', function () {
    var walk = (0, rules_1.walkFrom)(reported);
    (0, testing_1.expect)(walk === null || walk === void 0 ? void 0 : walk.findings).toEqual([
        { where: 'src/a.ts:3', category: 'correctness', label: 'Null check missing' },
        { where: 'src/b.ts', category: null, label: 'Query runs per row' },
    ]);
    (0, testing_1.expect)((0, rules_1.walkFrom)(reported.map(function (f) { return (__assign(__assign({}, f), { outcome: 'fixed' })); }))).toBe(null);
    (0, testing_1.expect)((0, rules_1.walkFrom)([])).toBe(null);
});
(0, testing_1.test)('only an N/M header matching the walk\'s size is a position', function () {
    var walk = (0, rules_1.walkFrom)(reported);
    (0, testing_1.expect)((0, rules_1.positionOf)('2/2', walk)).toBe(1);
    (0, testing_1.expect)((0, rules_1.positionOf)('2/3', walk)).toBe(null);
    (0, testing_1.expect)((0, rules_1.positionOf)('3/2', walk)).toBe(null);
    (0, testing_1.expect)((0, rules_1.positionOf)('Route', walk)).toBe(null);
    (0, testing_1.expect)((0, rules_1.positionOf)('1/2', null)).toBe(null);
});
(0, testing_1.test)('answers map to decisions by their first word', function () {
    (0, testing_1.expect)((0, rules_1.decisionOf)('Fix now (Recommended)')).toBe('fix');
    (0, testing_1.expect)((0, rules_1.decisionOf)('Issue')).toBe('issue');
    (0, testing_1.expect)((0, rules_1.decisionOf)('skip')).toBe('skip');
    (0, testing_1.expect)((0, rules_1.decisionOf)('only the rename please')).toBe('other');
    (0, testing_1.expect)((0, rules_1.decisionOf)(undefined)).toBe(null);
});
(0, testing_1.test)('the bar fills by share decided, and the tally counts each decision', function () {
    (0, testing_1.expect)((0, rules_1.bar)(1, 4)).toBe('▓▓▓▓▓░░░░░░░░░░░░░░░');
    var walk = (0, rules_1.walkFrom)(reported);
    (0, testing_1.expect)((0, rules_1.tally)(__assign(__assign({}, walk), { decisions: ['fix', 'other'] }))).toBe('fix 1 · issue 0 · skip 0 · other 1');
});
(0, testing_1.test)('only the review-walk skill arms a walk, as a user or a plugin skill', function () {
    (0, testing_1.expect)((0, rules_1.isWalkSkill)('review-walk')).toBe(true);
    (0, testing_1.expect)((0, rules_1.isWalkSkill)('review-walk:review-walk')).toBe(true);
    (0, testing_1.expect)((0, rules_1.isWalkSkill)('code-review')).toBe(false);
    (0, testing_1.expect)((0, rules_1.isWalkSkill)(undefined)).toBe(false);
});
(0, testing_1.test)('decisions recorded without a question count, and only inside the walk', function () {
    var walk = (0, rules_1.walkFrom)(reported);
    var decided = (0, rules_1.decide)(walk, [1, 2], 'fix');
    (0, testing_1.expect)(typeof decided === 'string' ? decided : decided.decisions).toEqual(['fix', 'fix']);
    (0, testing_1.expect)((0, rules_1.decide)(walk, [3], 'skip')).toBe('Findings are numbered 1 to 2; got 3.');
    (0, testing_1.expect)((0, rules_1.decide)(walk, [], 'skip')).toBe('Findings are numbered 1 to 2; got none.');
    (0, testing_1.expect)((0, rules_1.decide)(null, [1], 'fix')).toBe('No review walk is active.');
});
(0, testing_1.test)('a walk with every finding decided is settled', function () {
    var walk = (0, rules_1.walkFrom)(reported);
    (0, testing_1.expect)((0, rules_1.settled)(__assign(__assign({}, walk), { decisions: ['fix', null] }))).toEqual(__assign(__assign({}, walk), { decisions: ['fix', null] }));
    (0, testing_1.expect)((0, rules_1.settled)(__assign(__assign({}, walk), { decisions: ['fix', 'skip'] }))).toBe(null);
    (0, testing_1.expect)((0, rules_1.settled)(null)).toBe(null);
});
