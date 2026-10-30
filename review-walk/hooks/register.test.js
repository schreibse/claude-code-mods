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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var testing_1 = require("claude-code/testing");
var FINDINGS = [
    { file: 'src/a.ts', line: 3, summary: 'Null check missing on the parsed id', short_summary: 'Null check missing', failure_scenario: 'x', category: 'correctness' },
    { file: 'src/b.ts', summary: 'Query runs per row', failure_scenario: 'y' },
];
function engine($t, on, answer) {
    var _this = this;
    var duringQuestion = [];
    on('session.id', function () { return ({ value: 's1' }); });
    on('tool.call', function (_, e) { return __awaiter(_this, void 0, void 0, function () {
        var call, shown;
        var _a;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    call = e;
                    if (call.tool !== 'AskUserQuestion') {
                        return [2 /*return*/, { isError: false, result: {} }];
                    }
                    return [4 /*yield*/, band($t)];
                case 1: return [4 /*yield*/, (_e.sent()).find({ type: 'Text', text: 'Review walk ' })];
                case 2:
                    shown = _e.sent();
                    duringQuestion.push(shown === undefined ? 'on the dialog' : 'in the band');
                    return [2 /*return*/, { isError: false, result: { answers: (_a = {}, _a[(_d = (_c = (_b = call.questions) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.question) !== null && _d !== void 0 ? _d : ''] = answer, _a) } }];
            }
        });
    }); });
    on('ui.render', { component: 'AbovePrompt' }, function ($, e) {
        var Box = $.ui.resolve(e).Box;
        return <Box />;
    });
    return { duringQuestion: duringQuestion };
}
var band = function ($) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    return [2 /*return*/, $.ui.mount({ plugin: 'review-walk', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false } })];
}); }); };
var SKILL = { tool: 'Skill', skill: 'review-walk' };
var DECIDE = 'mcp__review-walk__ReviewWalkDecide';
var ask = function (header) { return ({
    tool: 'AskUserQuestion',
    questions: [{ question: 'Null check missing: fix it?', header: header, multiSelect: false, options: [{ label: 'Fix', description: '' }, { label: 'Skip', description: '' }] }],
}); };
(0, testing_1.test)('a report starts the walk; each N/M answer moves the bar and the tally', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var duringQuestion, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                duringQuestion = engine($, on, 'Fix').duringQuestion;
                _a = testing_1.expect;
                return [4 /*yield*/, band($)];
            case 1: return [4 /*yield*/, (_d.sent()).find({ type: 'Text', text: ' 0/2 decided · fix 0 · issue 0 · skip 0' })];
            case 2:
                _a.apply(void 0, [_d.sent()]).toBe(undefined);
                return [4 /*yield*/, $.tool.call(SKILL)];
            case 3:
                _d.sent();
                return [4 /*yield*/, $.tool.call({ tool: 'ReportFindings', findings: FINDINGS })];
            case 4:
                _d.sent();
                _b = testing_1.expect;
                return [4 /*yield*/, band($)];
            case 5: return [4 /*yield*/, (_d.sent()).find({ type: 'Text', text: ' 0/2 decided · fix 0 · issue 0 · skip 0' })];
            case 6:
                _b.apply(void 0, [_d.sent()]).toBeDefined();
                return [4 /*yield*/, $.tool.call(ask('1/2'))];
            case 7:
                _d.sent();
                (0, testing_1.expect)(duringQuestion).toEqual(['on the dialog']);
                _c = testing_1.expect;
                return [4 /*yield*/, band($)];
            case 8: return [4 /*yield*/, (_d.sent()).find({ type: 'Text', text: ' 1/2 decided · fix 1 · issue 0 · skip 0' })];
            case 9:
                _c.apply(void 0, [_d.sent()]).toBeDefined();
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('the closing report with outcomes ends the walk', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                engine($, on, 'Fix');
                return [4 /*yield*/, $.tool.call(SKILL)];
            case 1:
                _b.sent();
                return [4 /*yield*/, $.tool.call({ tool: 'ReportFindings', findings: FINDINGS })];
            case 2:
                _b.sent();
                return [4 /*yield*/, $.tool.call({ tool: 'ReportFindings', findings: FINDINGS.map(function (f) { return (__assign(__assign({}, f), { outcome: 'fixed' })); }) })];
            case 3:
                _b.sent();
                _a = testing_1.expect;
                return [4 /*yield*/, band($)];
            case 4: return [4 /*yield*/, (_b.sent()).find({ type: 'Text', text: 'Review walk ' })];
            case 5:
                _a.apply(void 0, [_b.sent()]).toBe(undefined);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('a question outside the walk leaves it alone', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var duringQuestion, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                duringQuestion = engine($, on, 'Fix').duringQuestion;
                return [4 /*yield*/, $.tool.call(SKILL)];
            case 1:
                _b.sent();
                return [4 /*yield*/, $.tool.call({ tool: 'ReportFindings', findings: FINDINGS })];
            case 2:
                _b.sent();
                return [4 /*yield*/, $.tool.call(ask('Route'))];
            case 3:
                _b.sent();
                (0, testing_1.expect)(duringQuestion).toEqual(['in the band']);
                _a = testing_1.expect;
                return [4 /*yield*/, band($)];
            case 4: return [4 /*yield*/, (_b.sent()).find({ type: 'Text', text: ' 0/2 decided · fix 0 · issue 0 · skip 0' })];
            case 5:
                _a.apply(void 0, [_b.sent()]).toBeDefined();
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('a report starts a walk only after the review-walk skill ran, and the closing report disarms it', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                engine($, on, 'Fix');
                return [4 /*yield*/, $.tool.call({ tool: 'ReportFindings', findings: FINDINGS })];
            case 1:
                _c.sent();
                _a = testing_1.expect;
                return [4 /*yield*/, band($)];
            case 2: return [4 /*yield*/, (_c.sent()).find({ type: 'Text', text: 'Review walk ' })];
            case 3:
                _a.apply(void 0, [_c.sent()]).toBe(undefined);
                return [4 /*yield*/, $.tool.call(SKILL)];
            case 4:
                _c.sent();
                return [4 /*yield*/, $.tool.call({ tool: 'ReportFindings', findings: FINDINGS })];
            case 5:
                _c.sent();
                return [4 /*yield*/, $.tool.call({ tool: 'ReportFindings', findings: FINDINGS.map(function (f) { return (__assign(__assign({}, f), { outcome: 'fixed' })); }) })];
            case 6:
                _c.sent();
                return [4 /*yield*/, $.tool.call({ tool: 'ReportFindings', findings: FINDINGS })];
            case 7:
                _c.sent();
                _b = testing_1.expect;
                return [4 /*yield*/, band($)];
            case 8: return [4 /*yield*/, (_c.sent()).find({ type: 'Text', text: 'Review walk ' })];
            case 9:
                _b.apply(void 0, [_c.sent()]).toBe(undefined);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('decisions recorded without a question move the tally', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                engine($, on, 'Fix');
                _a = testing_1.expect;
                return [4 /*yield*/, $.tool.call({ tool: DECIDE, findings: [1], decision: 'fix' })];
            case 1:
                _a.apply(void 0, [_e.sent()]).toEqual({ deny: 'No review walk is active.' });
                return [4 /*yield*/, $.tool.call(SKILL)];
            case 2:
                _e.sent();
                return [4 /*yield*/, $.tool.call({ tool: 'ReportFindings', findings: FINDINGS })];
            case 3:
                _e.sent();
                _b = testing_1.expect;
                return [4 /*yield*/, $.tool.call({ tool: DECIDE, findings: [3], decision: 'skip' })];
            case 4:
                _b.apply(void 0, [_e.sent()]).toEqual({ deny: 'Findings are numbered 1 to 2; got 3.' });
                _c = testing_1.expect;
                return [4 /*yield*/, $.tool.call({ tool: DECIDE, findings: [1], decision: 'fix' })];
            case 5:
                _c.apply(void 0, [_e.sent()]).toEqual({ result: 'Recorded fix for finding 1; 1/2 decided.' });
                _d = testing_1.expect;
                return [4 /*yield*/, band($)];
            case 6: return [4 /*yield*/, (_e.sent()).find({ type: 'Text', text: ' 1/2 decided · fix 1 · issue 0 · skip 0' })];
            case 7:
                _d.apply(void 0, [_e.sent()]).toBeDefined();
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('the last decision ends the walk without a closing report, and a later report needs the skill again', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                engine($, on, 'Skip');
                return [4 /*yield*/, $.tool.call(SKILL)];
            case 1:
                _c.sent();
                return [4 /*yield*/, $.tool.call({ tool: 'ReportFindings', findings: FINDINGS })];
            case 2:
                _c.sent();
                return [4 /*yield*/, $.tool.call({ tool: DECIDE, findings: [2], decision: 'fix' })];
            case 3:
                _c.sent();
                return [4 /*yield*/, $.tool.call(ask('1/2'))];
            case 4:
                _c.sent();
                _a = testing_1.expect;
                return [4 /*yield*/, band($)];
            case 5: return [4 /*yield*/, (_c.sent()).find({ type: 'Text', text: 'Review walk ' })];
            case 6:
                _a.apply(void 0, [_c.sent()]).toBe(undefined);
                return [4 /*yield*/, $.tool.call({ tool: 'ReportFindings', findings: FINDINGS })];
            case 7:
                _c.sent();
                _b = testing_1.expect;
                return [4 /*yield*/, band($)];
            case 8: return [4 /*yield*/, (_c.sent()).find({ type: 'Text', text: 'Review walk ' })];
            case 9:
                _b.apply(void 0, [_c.sent()]).toBe(undefined);
                return [2 /*return*/];
        }
    });
}); });
