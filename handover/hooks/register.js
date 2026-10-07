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
var COPY_COMMAND = 'handover-copy';
var PICK_COMMAND = 'handover';
var OFFER_EVERY_MS = 500;
var OFFER_TRIES = 20;
var PREVIEW_CHARS = 160;
var pending = (0, claude_code_1.atom)({ plugin: 'handover', key: 'pending' }, null);
var choices = (0, claude_code_1.atom)({ plugin: 'handover', key: 'choices' }, null);
// The key of the sentence last offered in the box; the next prompt sent spends it.
var offered = null;
function home($) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, $.env.get('HOME')];
                case 1: return [2 /*return*/, (_a = (_b.sent())) !== null && _a !== void 0 ? _a : ''];
            }
        });
    });
}
function entries($) {
    return __awaiter(this, void 0, void 0, function () {
        var found, _i, _a, key, _b, _c;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    found = [];
                    _i = 0;
                    return [4 /*yield*/, $.store.keys()];
                case 1:
                    _a = _e.sent();
                    _e.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 5];
                    key = _a[_i];
                    if (!((0, rules_1.sessionIdOf)(key) !== null)) return [3 /*break*/, 4];
                    _c = (_b = found).push;
                    _d = { key: key };
                    return [4 /*yield*/, $.store.get(key)];
                case 3:
                    _c.apply(_b, [(_d.handover = (_e.sent()), _d)]);
                    _e.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, found];
            }
        });
    });
}
function remove($, key) {
    return __awaiter(this, void 0, void 0, function () {
        var sessionId, dir;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.store.delete(key).catch(function () { return undefined; })];
                case 1:
                    _a.sent();
                    sessionId = (0, rules_1.sessionIdOf)(key);
                    return [4 /*yield*/, home($)];
                case 2:
                    dir = _a.sent();
                    if (!(sessionId !== null && dir !== '')) return [3 /*break*/, 4];
                    return [4 /*yield*/, $.process.run(['rm', '-f', (0, rules_1.sessionPath)(dir, sessionId)]).catch(function () { return undefined; })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
function choicesHere($) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = rules_1.choicesFor;
                    return [4 /*yield*/, entries($)];
                case 1:
                    _b = [_c.sent()];
                    return [4 /*yield*/, $.session.root()];
                case 2:
                    _b = _b.concat([_c.sent()]);
                    return [4 /*yield*/, $.clock.now()];
                case 3: return [2 /*return*/, _a.apply(void 0, _b.concat([_c.sent()]))];
            }
        });
    });
}
function suggest($, key, text) {
    var _this = this;
    offered = key;
    // The box refuses while the /clear's own turn still runs, and a reset of the box right after
    // can drop a suggestion it had taken, so the same text is proposed again for a while.
    var tries = 0;
    var timer = $.clock.every(OFFER_EVERY_MS, function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (++tries > OFFER_TRIES || offered !== key) {
                        timer.cancel();
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, $.prompt.suggest({ text: text })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
}
function preview(text) {
    return text.length > PREVIEW_CHARS ? "".concat(text.slice(0, PREVIEW_CHARS - 1), "\u2026") : text;
}
var register = function (on) {
    // Every session's sentence goes to a file and a key of its own, so parallel sessions never overwrite one another.
    on('tool.call', { tool: 'Write' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var dir, sessionId, target, result, text, handover;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, home($)];
                case 1:
                    dir = _b.sent();
                    return [4 /*yield*/, $.session.id()];
                case 2:
                    sessionId = _b.sent();
                    target = (0, rules_1.sessionPath)(dir, sessionId);
                    if (dir === '' || (e.file_path !== (0, rules_1.handoverPath)(dir) && e.file_path !== target)) {
                        return [2 /*return*/, next(e)];
                    }
                    return [4 /*yield*/, next(__assign(__assign({}, e), { file_path: target }))];
                case 3:
                    result = _b.sent();
                    if (result.isError) {
                        return [2 /*return*/, result];
                    }
                    text = (0, rules_1.sentenceOf)(e.content);
                    _a = { text: text };
                    return [4 /*yield*/, $.clock.now()];
                case 4:
                    _a.at = _b.sent();
                    return [4 /*yield*/, $.session.root()];
                case 5:
                    handover = (_a.root = _b.sent(), _a);
                    return [4 /*yield*/, $.store.set((0, rules_1.storeKey)(sessionId), handover)];
                case 6:
                    _b.sent();
                    return [4 /*yield*/, (0, claude_code_1.update)($, pending, function () { return text; })];
                case 7:
                    _b.sent();
                    return [2 /*return*/, result];
            }
        });
    }); });
    // A /clear fires no session.start; the id read before it runs is the session that wrote the sentence.
    on('command.run', { command: 'clear' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var key, _a, result, stored, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = rules_1.storeKey;
                    return [4 /*yield*/, $.session.id()];
                case 1:
                    key = _a.apply(void 0, [_d.sent()]);
                    return [4 /*yield*/, next(e)];
                case 2:
                    result = _d.sent();
                    return [4 /*yield*/, $.store.get(key)];
                case 3:
                    stored = (_d.sent());
                    _b = rules_1.isFresh;
                    _c = [stored];
                    return [4 /*yield*/, $.clock.now()];
                case 4:
                    if (!_b.apply(void 0, _c.concat([_d.sent()]))) return [3 /*break*/, 6];
                    return [4 /*yield*/, (0, claude_code_1.update)($, pending, function () { return null; })];
                case 5:
                    _d.sent();
                    suggest($, key, stored.text);
                    _d.label = 6;
                case 6: return [2 /*return*/, result];
            }
        });
    }); });
    // A new process cannot tell which of a repo's sessions it continues, so it lists them and the person picks.
    on('classic.SessionStart', { source: 'startup' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var result, now, _i, _a, _b, key, handover, here;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, next(e)];
                case 1:
                    result = _c.sent();
                    return [4 /*yield*/, $.clock.now()];
                case 2:
                    now = _c.sent();
                    _i = 0;
                    return [4 /*yield*/, entries($)];
                case 3:
                    _a = _c.sent();
                    _c.label = 4;
                case 4:
                    if (!(_i < _a.length)) return [3 /*break*/, 7];
                    _b = _a[_i], key = _b.key, handover = _b.handover;
                    if (!!(0, rules_1.isFresh)(handover, now)) return [3 /*break*/, 6];
                    return [4 /*yield*/, remove($, key)];
                case 5:
                    _c.sent();
                    _c.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7: return [4 /*yield*/, choicesHere($)];
                case 8:
                    here = _c.sent();
                    return [4 /*yield*/, (0, claude_code_1.update)($, choices, function () { return (here.length > 0 ? here.map(function (c) { return c.handover.text; }) : null); })];
                case 9:
                    _c.sent();
                    return [2 /*return*/, result];
            }
        });
    }); });
    on('prompt.submit', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var key;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(offered !== null)) return [3 /*break*/, 2];
                    key = offered;
                    offered = null;
                    return [4 /*yield*/, remove($, key)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/, next(e)];
            }
        });
    }); });
    on('session.start', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.command.register({ name: COPY_COMMAND, description: 'Copy the handover sentence and hide its band' })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, $.command.register({ name: PICK_COMMAND, description: 'List this repo\'s handovers; /handover N puts one in the prompt' })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, next(e)];
            }
        });
    }); });
    // A band's buttons take a press only once it holds focus, so copying is a command typed at the prompt.
    on('command.run', { command: COPY_COMMAND }, function ($) { return __awaiter(void 0, void 0, void 0, function () {
        var text, _a, _b, _c, _d, copied;
        var _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.read)($, pending)];
                case 1:
                    if (!((_e = _g.sent()) !== null && _e !== void 0)) return [3 /*break*/, 2];
                    _a = _e;
                    return [3 /*break*/, 5];
                case 2:
                    _c = (_b = $.store).get;
                    _d = rules_1.storeKey;
                    return [4 /*yield*/, $.session.id()];
                case 3: return [4 /*yield*/, _c.apply(_b, [_d.apply(void 0, [_g.sent()])])];
                case 4:
                    _a = (_f = ((_g.sent()))) === null || _f === void 0 ? void 0 : _f.text;
                    _g.label = 5;
                case 5:
                    text = _a;
                    if (!text) {
                        return [2 /*return*/, { text: 'No handover sentence yet.' }];
                    }
                    return [4 /*yield*/, $.ui.copy({ text: text })];
                case 6:
                    copied = _g.sent();
                    if (!copied.isCopied) {
                        return [2 /*return*/, { text: "Not copied: ".concat(copied.reason) }];
                    }
                    return [4 /*yield*/, (0, claude_code_1.update)($, pending, function () { return null; })];
                case 7:
                    _g.sent();
                    return [2 /*return*/, { text: 'Handover copied.' }];
            }
        });
    }); });
    on('command.run', { command: PICK_COMMAND }, function ($, e) { return __awaiter(void 0, void 0, void 0, function () {
        var here, n, chosen;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, choicesHere($)];
                case 1:
                    here = _a.sent();
                    if (here.length === 0) {
                        return [2 /*return*/, { text: 'No handover for this repo.' }];
                    }
                    n = Number(e.args.trim());
                    if (!Number.isInteger(n) || n < 1 || n > here.length) {
                        return [2 /*return*/, { text: here.map(function (c, i) { return "".concat(i + 1, ". ").concat(c.handover.text); }).join('\n\n') }];
                    }
                    chosen = here[n - 1];
                    return [4 /*yield*/, (0, claude_code_1.update)($, choices, function () { return null; })];
                case 2:
                    _a.sent();
                    suggest($, chosen.key, chosen.handover.text);
                    return [2 /*return*/, { text: "Handover ".concat(n, " waits in the prompt; Tab takes it.") }];
            }
        });
    }); });
    on('ui.render', { component: 'AbovePrompt' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var text, listed, band, _a, Box, Text;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.read)($, pending)];
                case 1:
                    text = _b.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, choices)];
                case 2:
                    listed = _b.sent();
                    return [4 /*yield*/, next(e)];
                case 3:
                    band = _b.sent();
                    if ((text === null && listed === null) || e.props.hasSurvey) {
                        return [2 /*return*/, band];
                    }
                    _a = $.ui.resolve(e), Box = _a.Box, Text = _a.Text;
                    return [2 /*return*/, (<Box flexDirection="column">
        {band}
        {text !== null && (<Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="cyan">
            <Box>
              <Text color="cyan" bold>handover </Text>
              <Text dimColor>/{COPY_COMMAND} to copy · /clear, then Tab</Text>
            </Box>
            <Text>{text}</Text>
          </Box>)}
        {listed !== null && (<Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="cyan">
            <Box>
              <Text color="cyan" bold>handovers for this repo </Text>
              <Text dimColor>/{PICK_COMMAND} N puts one in the prompt</Text>
            </Box>
            {listed.map(function (t, i) { return (<Text key={String(i)}>{"".concat(i + 1, ". ").concat(preview(t))}</Text>); })}
          </Box>)}
      </Box>)];
            }
        });
    }); });
};
exports.register = register;
