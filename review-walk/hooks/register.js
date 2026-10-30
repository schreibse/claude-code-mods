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
exports.register = void 0;
var claude_code_1 = require("claude-code");
var rules_1 = require("./rules");
var walk = (0, claude_code_1.atom)({ plugin: 'review-walk', key: 'walk' }, null);
var DECIDE = 'ReviewWalkDecide';
var DECISIONS = ['fix', 'issue', 'skip'];
// The session whose review-walk skill ran last: only its reports start or end a walk.
var armedFor = null;
function progress($, e, current) {
    var _a, _b;
    var _c = $.ui.resolve(e), Box = _c.Box, Text = _c.Text;
    var done = (0, rules_1.decided)(current);
    var total = current.findings.length;
    var finding = current.asking === null ? null : ((_a = current.findings[current.asking]) !== null && _a !== void 0 ? _a : null);
    return (<Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="magenta">
      <Box>
        <Text color="magenta" bold>
          {finding === null ? 'Review walk ' : "Finding ".concat(((_b = current.asking) !== null && _b !== void 0 ? _b : 0) + 1, "/").concat(total, " ")}
        </Text>
        <Text color="magenta">{(0, rules_1.bar)(done, total)}</Text>
        <Text dimColor>{" ".concat(done, "/").concat(total, " decided \u00B7 ").concat((0, rules_1.tally)(current))}</Text>
      </Box>
      {finding !== null && <Text>{(0, rules_1.describe)(finding)}</Text>}
    </Box>);
}
function finish($, next) {
    return __awaiter(this, void 0, void 0, function () {
        var remaining;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    remaining = (0, rules_1.settled)(next);
                    if (remaining === null) {
                        armedFor = null;
                    }
                    return [4 /*yield*/, (0, claude_code_1.update)($, walk, function () { return remaining; })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
var register = function (on) {
    on('session.start', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.tool.register({
                        name: DECIDE,
                        description: 'Records review-walk decisions the user authorised without a question, so the walk band counts them. findings are the 1-based N of N/M.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                findings: { type: 'array', items: { type: 'integer', minimum: 1 }, minItems: 1 },
                                decision: { type: 'string', enum: DECISIONS },
                            },
                            required: ['findings', 'decision'],
                        },
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, next(e)];
            }
        });
    }); });
    on('tool.call', { tool: 'Skill' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, next(e)];
                case 1:
                    result = _a.sent();
                    if (!(!result.isError && (0, rules_1.isWalkSkill)(e.skill))) return [3 /*break*/, 3];
                    return [4 /*yield*/, $.session.id()];
                case 2:
                    armedFor = _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/, result];
            }
        });
    }); });
    on('command.run', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(0, rules_1.isWalkSkill)(e.command)) return [3 /*break*/, 2];
                    return [4 /*yield*/, $.session.id()];
                case 1:
                    armedFor = _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/, next(e)];
            }
        });
    }); });
    on('tool.call', { tool: 'ReportFindings' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var result, _a, _b, started;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, next(e)];
                case 1:
                    result = _c.sent();
                    _a = result.isError || armedFor === null;
                    if (_a) return [3 /*break*/, 3];
                    _b = armedFor;
                    return [4 /*yield*/, $.session.id()];
                case 2:
                    _a = _b !== (_c.sent());
                    _c.label = 3;
                case 3:
                    if (_a) {
                        return [2 /*return*/, result];
                    }
                    started = (0, rules_1.walkFrom)(e.findings);
                    if (started === null) {
                        armedFor = null;
                    }
                    return [4 /*yield*/, (0, claude_code_1.update)($, walk, function () { return started; }).catch(function () { return undefined; })];
                case 4:
                    _c.sent();
                    return [2 /*return*/, result];
            }
        });
    }); });
    on('tool.call', { tool: /^mcp__review-walk__ReviewWalkDecide$/ }, function ($, e) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, findings, decision, updated, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = e, findings = _a.findings, decision = _a.decision;
                    if (!Array.isArray(findings) || typeof decision !== 'string' || !DECISIONS.includes(decision)) {
                        return [2 /*return*/, { deny: "".concat(DECIDE, " takes { findings: number[], decision: 'fix' | 'issue' | 'skip' }.") }];
                    }
                    _b = rules_1.decide;
                    return [4 /*yield*/, (0, claude_code_1.read)($, walk)];
                case 1:
                    updated = _b.apply(void 0, [_c.sent(), findings, decision]);
                    if (typeof updated === 'string') {
                        return [2 /*return*/, { deny: updated }];
                    }
                    return [4 /*yield*/, finish($, updated)];
                case 2:
                    _c.sent();
                    return [2 /*return*/, { result: "Recorded ".concat(decision, " for finding ").concat(findings.join(', '), "; ").concat((0, rules_1.decided)(updated), "/").concat(updated.findings.length, " decided.") }];
            }
        });
    }); });
    on('tool.call', { tool: 'AskUserQuestion' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var question, index, _a, _b, result, answers, decision, current, decisions;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    question = e.questions[0];
                    _a = rules_1.positionOf;
                    _b = [question === null || question === void 0 ? void 0 : question.header];
                    return [4 /*yield*/, (0, claude_code_1.read)($, walk).catch(function () { return null; })];
                case 1:
                    index = _a.apply(void 0, _b.concat([_e.sent()]));
                    if (index === null || question === undefined) {
                        return [2 /*return*/, next(e)];
                    }
                    return [4 /*yield*/, (0, claude_code_1.update)($, walk, function (w) { return (w === null ? w : __assign(__assign({}, w), { asking: index })); }).catch(function () { return undefined; })];
                case 2:
                    _e.sent();
                    return [4 /*yield*/, next(e)];
                case 3:
                    result = _e.sent();
                    answers = (_d = ((_c = result.result) !== null && _c !== void 0 ? _c : {}).answers) !== null && _d !== void 0 ? _d : {};
                    decision = (0, rules_1.decisionOf)(answers[question.question]);
                    return [4 /*yield*/, (0, claude_code_1.read)($, walk).catch(function () { return null; })];
                case 4:
                    current = _e.sent();
                    if (!(current !== null)) return [3 /*break*/, 6];
                    decisions = decision === null ? current.decisions : current.decisions.map(function (d, i) { return (i === index ? decision : d); });
                    return [4 /*yield*/, finish($, __assign(__assign({}, current), { asking: null, decisions: decisions })).catch(function () { return undefined; })];
                case 5:
                    _e.sent();
                    _e.label = 6;
                case 6: return [2 /*return*/, result];
            }
        });
    }); });
    on('ui.render', { component: 'AskUserQuestion' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var current, dialog, Box;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.read)($, walk)];
                case 1:
                    current = _a.sent();
                    return [4 /*yield*/, next(e)];
                case 2:
                    dialog = _a.sent();
                    if (current === null || current.asking === null) {
                        return [2 /*return*/, dialog];
                    }
                    Box = $.ui.resolve(e).Box;
                    return [2 /*return*/, (<Box flexDirection="column">
        {progress($, e, current)}
        {dialog}
      </Box>)];
            }
        });
    }); });
    on('ui.render', { component: 'AbovePrompt' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var current, band, Box;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.read)($, walk)];
                case 1:
                    current = _a.sent();
                    return [4 /*yield*/, next(e)];
                case 2:
                    band = _a.sent();
                    if (current === null || current.asking !== null || e.props.hasSurvey) {
                        return [2 /*return*/, band];
                    }
                    Box = $.ui.resolve(e).Box;
                    return [2 /*return*/, (<Box flexDirection="column">
        {band}
        {progress($, e, current)}
      </Box>)];
            }
        });
    }); });
};
exports.register = register;
