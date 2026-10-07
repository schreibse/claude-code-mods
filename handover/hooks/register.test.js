"use strict";
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
var testing_1 = require("claude-code/testing");
var WORK = 'PR #146 merged as 5fd98a4; next is #132 — read .claude/plans/132.md first.';
var ANALYZE = 'Analysis of #140 done; next is the write-up — read .claude/plans/140.md first.';
var DAY = 24 * 60 * 60 * 1000;
function home(on) {
    var session = { id: 's1' };
    var writes = [];
    var removed = [];
    var suggested = [];
    on('env.get', function () { return ({ value: '/home/me' }); });
    on('session.root', function () { return ({ value: '/r/repo' }); });
    on('session.id', function () { return ({ value: session.id }); });
    on('tool.call', function (_, e) {
        writes.push(e.file_path);
        return { isError: false, result: {} };
    });
    on('classic.SessionStart', function () { return ({}); });
    on('prompt.submit', function (_, e) { return ({ text: e.text }); });
    on('prompt.suggest', function (_, e) {
        suggested.push(e.text);
        return { isShown: true };
    });
    on('process.run', function (_, e) {
        var _a;
        removed.push((_a = e.argv.at(-1)) !== null && _a !== void 0 ? _a : '');
        return { value: { exitCode: 0, stdout: '', stderr: '' } };
    });
    var store = new Map();
    on('store.get', function (_, e) { return ({ value: store.get(e.key) }); });
    on('store.keys', function () { return ({ value: __spreadArray([], store.keys(), true) }); });
    on('store.set', function (_, e) {
        var _a = e, key = _a.key, value = _a.value;
        store.set(key, value);
        return { value: undefined };
    });
    on('store.delete', function (_, e) {
        store.delete(e.key);
        return { value: undefined };
    });
    on('ui.render', { component: 'AbovePrompt' }, function ($, e) {
        var Box = $.ui.resolve(e).Box;
        return <Box />;
    });
    return { clock: testing_1.mock.clock(on, { now: 1000 }), session: session, writes: writes, removed: removed, suggested: suggested, store: store };
}
var band = function ($) {
    return $.ui.mount({ plugin: 'handover', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false } });
};
(0, testing_1.test)('the sentence goes to a file of the session\'s own and shows in the band', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var writes, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                writes = home(on).writes;
                return [4 /*yield*/, $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: "".concat(WORK, "\n") })];
            case 1:
                _b.sent();
                (0, testing_1.expect)(writes).toEqual(['/home/me/.claude/handovers/s1.md']);
                _a = testing_1.expect;
                return [4 /*yield*/, band($)];
            case 2: return [4 /*yield*/, (_b.sent()).find({ type: 'Text', text: WORK })];
            case 3:
                _a.apply(void 0, [_b.sent()]).toBeDefined();
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('other files pass untouched and leave the band away', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var writes, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                writes = home(on).writes;
                return [4 /*yield*/, $.tool.call({ tool: 'Write', file_path: '/r/repo/handover.md', content: WORK })];
            case 1:
                _b.sent();
                (0, testing_1.expect)(writes).toEqual(['/r/repo/handover.md']);
                _a = testing_1.expect;
                return [4 /*yield*/, band($)];
            case 2: return [4 /*yield*/, (_b.sent()).find({ type: 'Text', text: WORK })];
            case 3:
                _a.apply(void 0, [_b.sent()]).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('two sessions in one repo keep a sentence each', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, session, store;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = home(on), session = _a.session, store = _a.store;
                return [4 /*yield*/, $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: WORK })];
            case 1:
                _b.sent();
                session.id = 's2';
                return [4 /*yield*/, $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: ANALYZE })];
            case 2:
                _b.sent();
                (0, testing_1.expect)(__spreadArray([], store.keys(), true)).toEqual(['handover:s1', 'handover:s2']);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('after /clear the session\'s own sentence is proposed, and the first prompt spends it', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, clock, session, removed, suggested, store;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = home(on), clock = _a.clock, session = _a.session, removed = _a.removed, suggested = _a.suggested, store = _a.store;
                on('command.run', { command: 'clear' }, function () {
                    session.id = 's3';
                    return { text: '' };
                });
                store.set('handover:s2', { text: ANALYZE, at: 1000, root: '/r/repo' });
                return [4 /*yield*/, $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: WORK })];
            case 1:
                _b.sent();
                return [4 /*yield*/, $.command.run({ command: 'clear', args: '' })];
            case 2:
                _b.sent();
                return [4 /*yield*/, clock.advance(1000)];
            case 3:
                _b.sent();
                (0, testing_1.expect)(suggested).toEqual([WORK, WORK]);
                return [4 /*yield*/, $.prompt.submit({ text: 'something else' })];
            case 4:
                _b.sent();
                return [4 /*yield*/, clock.advance(5000)];
            case 5:
                _b.sent();
                (0, testing_1.expect)(suggested).toHaveLength(2);
                (0, testing_1.expect)(removed).toEqual(['/home/me/.claude/handovers/s1.md']);
                (0, testing_1.expect)(__spreadArray([], store.keys(), true)).toEqual(['handover:s2']);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('a fresh process proposes nothing but lists the repo\'s sentences, newest first', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, clock, removed, suggested, store, ui, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = home(on), clock = _a.clock, removed = _a.removed, suggested = _a.suggested, store = _a.store;
                store.set('handover:old', { text: 'old', at: 1000 - 15 * DAY, root: '/r/repo' });
                store.set('handover:s1', { text: WORK, at: 500, root: '/r/repo' });
                store.set('handover:s2', { text: ANALYZE, at: 900, root: '/r/repo' });
                store.set('handover:s9', { text: 'elsewhere', at: 900, root: '/r/other' });
                return [4 /*yield*/, $.classic.SessionStart({ source: 'startup' })];
            case 1:
                _e.sent();
                return [4 /*yield*/, clock.advance(5000)];
            case 2:
                _e.sent();
                (0, testing_1.expect)(suggested).toEqual([]);
                (0, testing_1.expect)(removed).toEqual(['/home/me/.claude/handovers/old.md']);
                return [4 /*yield*/, band($)];
            case 3:
                ui = _e.sent();
                _b = testing_1.expect;
                return [4 /*yield*/, ui.find({ type: 'Text', text: "1. ".concat(ANALYZE) })];
            case 4:
                _b.apply(void 0, [_e.sent()]).toBeDefined();
                _c = testing_1.expect;
                return [4 /*yield*/, ui.find({ type: 'Text', text: "2. ".concat(WORK) })];
            case 5:
                _c.apply(void 0, [_e.sent()]).toBeDefined();
                _d = testing_1.expect;
                return [4 /*yield*/, ui.find({ type: 'Text', text: '3. elsewhere' })];
            case 6:
                _d.apply(void 0, [_e.sent()]).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('/handover lists, /handover N proposes that one and the next prompt spends it', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, clock, removed, suggested, store, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = home(on), clock = _a.clock, removed = _a.removed, suggested = _a.suggested, store = _a.store;
                store.set('handover:s1', { text: WORK, at: 500, root: '/r/repo' });
                store.set('handover:s2', { text: ANALYZE, at: 900, root: '/r/repo' });
                _b = testing_1.expect;
                return [4 /*yield*/, $.command.run({ command: 'handover', args: '' })];
            case 1:
                _b.apply(void 0, [(_d.sent()).text]).toBe("1. ".concat(ANALYZE, "\n\n2. ").concat(WORK));
                _c = testing_1.expect;
                return [4 /*yield*/, $.command.run({ command: 'handover', args: '2' })];
            case 2:
                _c.apply(void 0, [(_d.sent()).text]).toBe('Handover 2 waits in the prompt; Tab takes it.');
                return [4 /*yield*/, clock.advance(500)];
            case 3:
                _d.sent();
                (0, testing_1.expect)(suggested).toEqual([WORK]);
                return [4 /*yield*/, $.prompt.submit({ text: WORK })];
            case 4:
                _d.sent();
                (0, testing_1.expect)(removed).toEqual(['/home/me/.claude/handovers/s1.md']);
                (0, testing_1.expect)(__spreadArray([], store.keys(), true)).toEqual(['handover:s2']);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('/handover-copy copies the sentence and hides the band', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var copied, run, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                home(on);
                copied = [];
                on('ui.copy', function (_, e) {
                    copied.push(e.text);
                    return { value: { isCopied: true } };
                });
                return [4 /*yield*/, $.tool.call({ tool: 'Write', file_path: '/home/me/.claude/handover.md', content: WORK })];
            case 1:
                _b.sent();
                return [4 /*yield*/, $.command.run({ command: 'handover-copy', args: '' })];
            case 2:
                run = _b.sent();
                (0, testing_1.expect)(run.text).toBe('Handover copied.');
                (0, testing_1.expect)(copied).toEqual([WORK]);
                _a = testing_1.expect;
                return [4 /*yield*/, band($)];
            case 3: return [4 /*yield*/, (_b.sent()).find({ type: 'Text', text: WORK })];
            case 4:
                _a.apply(void 0, [_b.sent()]).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
