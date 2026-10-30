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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWalkSkill = isWalkSkill;
exports.walkFrom = walkFrom;
exports.positionOf = positionOf;
exports.decide = decide;
exports.settled = settled;
exports.decisionOf = decisionOf;
exports.decided = decided;
exports.bar = bar;
exports.tally = tally;
exports.describe = describe;
var BAR_WIDTH = 20;
var SKILL = 'review-walk';
/** The skill as a user skill (`review-walk`) or as the plugin's (`review-walk:review-walk`). */
function isWalkSkill(name) {
    return name === SKILL || name === "".concat(SKILL, ":").concat(SKILL);
}
/** A report without outcomes starts a walk; one with outcomes is the closing report and ends it. */
function walkFrom(reported) {
    if (reported.length === 0 || reported.some(function (f) { return f.outcome !== undefined; })) {
        return null;
    }
    var findings = reported.map(function (f) {
        var _a, _b;
        return ({
            where: f.line === undefined ? f.file : "".concat(f.file, ":").concat(f.line),
            category: (_a = f.category) !== null && _a !== void 0 ? _a : null,
            label: (_b = f.short_summary) !== null && _b !== void 0 ? _b : f.summary,
        });
    });
    return { findings: findings, asking: null, decisions: findings.map(function () { return null; }) };
}
/** The skill heads each finding's question `N/M`; anything else is not part of the walk. */
function positionOf(header, walk) {
    var _a;
    var match = /^(\d+)\/(\d+)$/.exec((_a = header === null || header === void 0 ? void 0 : header.trim()) !== null && _a !== void 0 ? _a : '');
    if (walk === null || match === null || Number(match[2]) !== walk.findings.length) {
        return null;
    }
    var n = Number(match[1]);
    return n >= 1 && n <= walk.findings.length ? n - 1 : null;
}
/** Records decisions the user authorised without a question; the text says why when they cannot apply. */
function decide(walk, findings, decision) {
    if (walk === null) {
        return 'No review walk is active.';
    }
    var total = walk.findings.length;
    var outside = findings.filter(function (n) { return !Number.isInteger(n) || n < 1 || n > total; });
    if (findings.length === 0 || outside.length > 0) {
        return "Findings are numbered 1 to ".concat(total, "; got ").concat(findings.join(', ') || 'none', ".");
    }
    var chosen = new Set(findings.map(function (n) { return n - 1; }));
    return __assign(__assign({}, walk), { decisions: walk.decisions.map(function (d, i) { return (chosen.has(i) ? decision : d); }) });
}
/** A walk with every finding decided is over: nothing is left to show, closing report or not. */
function settled(walk) {
    return walk === null || decided(walk) === walk.findings.length ? null : walk;
}
function decisionOf(answer) {
    var _a;
    var word = (_a = answer === null || answer === void 0 ? void 0 : answer.trim().toLowerCase()) !== null && _a !== void 0 ? _a : '';
    if (word === '') {
        return null;
    }
    return word.startsWith('fix') ? 'fix' : word.startsWith('issue') ? 'issue' : word.startsWith('skip') ? 'skip' : 'other';
}
function decided(walk) {
    return walk.decisions.filter(function (d) { return d !== null; }).length;
}
function bar(done, total) {
    var filled = total === 0 ? 0 : Math.round((done / total) * BAR_WIDTH);
    return '▓'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
}
function tally(walk) {
    var count = function (d) { return walk.decisions.filter(function (x) { return x === d; }).length; };
    var parts = ["fix ".concat(count('fix')), "issue ".concat(count('issue')), "skip ".concat(count('skip'))];
    return count('other') > 0 ? __spreadArray(__spreadArray([], parts, true), ["other ".concat(count('other'))], false).join(' · ') : parts.join(' · ');
}
function describe(finding) {
    return [finding.where, finding.category, finding.label].filter(Boolean).join(' · ');
}
