import { expect, test } from 'vitest';
import { clearDoc, loadDoc, nextSparkN, parseDoc, saveDoc } from './doc';
import { makeFrames, type FrameDef } from './canvas/fixtures';

const mem = () => { const m: Record<string, string> = {}; return { m, st: { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; }, removeItem: (k: string) => { delete m[k]; } } }; };
test('round trip keeps every frame', () => { const { st } = mem(); const f = makeFrames(20); expect(saveDoc(f, st)).toBeNull(); expect(loadDoc(st)).toEqual(f); });
test('nothing saved, corrupt JSON and storage that throws all give null (fresh design)', () => {
  const { m, st } = mem(); expect(loadDoc(st)).toBeNull(); m['swift-canvas.doc.v1'] = '{broken'; expect(loadDoc(st)).toBeNull();
  expect(loadDoc({ getItem: () => { throw new Error('blocked'); } })).toBeNull(); expect(loadDoc(undefined)).toBeNull();
});
test('parseDoc rejects the whole doc on one bad frame, duplicate ids, empty or absurd lists', () => {
  const [a, b] = makeFrames(3) as [FrameDef, FrameDef, FrameDef];
  expect(parseDoc({ frames: [a, b] })).toEqual([a, b]); expect(parseDoc({ frames: [a, { ...b, w: 0 }] })).toBeNull(); expect(parseDoc({ frames: [a, { ...b, html: '' }] })).toBeNull();
  expect(parseDoc({ frames: [a, { ...b, x: Number.NaN }] })).toBeNull(); expect(parseDoc({ frames: [a, { ...b, id: a.id }] })).toBeNull(); expect(parseDoc({ frames: [] })).toBeNull();
  expect(parseDoc({ frames: Array.from({ length: 201 }, (_, i) => ({ ...a, id: `f${i}` })) })).toBeNull(); expect(parseDoc(null)).toBeNull(); expect(parseDoc({ frames: 'x' })).toBeNull();
});
test('a failing save reports why instead of swallowing it', () => {
  const full = { setItem: () => { throw new Error('QuotaExceededError'); } }; expect(saveDoc(makeFrames(3), full)).toBe('QuotaExceededError'); expect(saveDoc(makeFrames(3), undefined)).toBe('storage unavailable');
});
test('clearDoc removes the saved design', () => { const { st } = mem(); saveDoc(makeFrames(3), st); clearDoc(st); expect(loadDoc(st)).toBeNull(); });
test('spark ids continue after the highest saved take', () => { const f = makeFrames(3) as [FrameDef, FrameDef, FrameDef]; expect(nextSparkN(f)).toBe(0); expect(nextSparkN([...f, { ...f[0], id: 'tv-t2' }, { ...f[0], id: 'tv-t11' }])).toBe(11); });
test('the kept flag survives a round trip', () => { const { st } = mem(); const f = makeFrames(3).map((x, i) => (i === 1 ? { ...x, id: 'tv-t1', kept: true } : x)); saveDoc(f, st); expect(loadDoc(st)).toEqual(f); });
test('each project has its own saved design; the default keeps the original key', () => {
  const { m, st } = mem(); const a = makeFrames(3); const b = makeFrames(5); saveDoc(a, st); saveDoc(b, st, 'radar'); expect(loadDoc(st)).toEqual(a); expect(loadDoc(st, 'radar')).toEqual(b); expect(loadDoc(st, 'other')).toBeNull();
  expect(Object.keys(m).sort()).toEqual(['swift-canvas.doc.v1', 'swift-canvas.doc.v1:radar']); clearDoc(st, 'radar'); expect(loadDoc(st, 'radar')).toBeNull(); expect(loadDoc(st)).toEqual(a);
});

import { fitLog, loadLog, MAX_LOG_OPS, parseLog, parseOp, saveDoc as saveDocWithLog } from './doc';
import * as L from './oplog';
const memory = () => { const m: Record<string, string> = {}; return { m, st: { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; }, removeItem: (k: string) => { delete m[k]; } } }; };
const fr = { id: 'tv', root: 'tv', title: 'TV', x: 0, y: 0, w: 10, h: 10, html: '<div id="tv"></div>' };
const sampleLog = (): L.Log => { let l = L.push(L.emptyLog(), { kind: 'set', frame: 'tv', el: 'clock', prop: 'color', before: '', after: 'red' }); l = L.push(l, { kind: 'snap', frame: 'tv', before: 'a', after: 'b', rec: 3 }); l = L.push(l, { kind: 'frameDel', frame: 'tv', def: fr, index: 1 }); l = L.push(l, { kind: 'discard', frame: 'tv', items: [{ def: fr, index: 0 }] }); l = L.push(l, { kind: 'group', label: 'g', ops: [{ kind: 'rename', frame: 'tv', before: 'a', after: 'b' }] }); return L.undo(l).log; };
test('the op log round-trips through storage with the frames (head and redo tail kept); frames-only saves still load', () => {
  const { st } = memory(); const log = sampleLog(); expect(saveDocWithLog([fr], st, 'p', log)).toBeNull(); expect(loadLog(st, 'p')).toEqual(log); expect(loadDoc(st, 'p')).toEqual([fr]);
  const old = memory(); expect(saveDocWithLog([fr], old.st, 'p')).toBeNull(); expect(loadLog(old.st, 'p')).toBeNull(); expect(loadDoc(old.st, 'p')).toEqual([fr]);
});
test('a damaged or inconsistent log is refused whole (null), never half-restored', () => {
  const good = JSON.parse(JSON.stringify(sampleLog())); expect(parseLog(good)).not.toBeNull();
  const bad = (f: (l: any) => void) => { const c = JSON.parse(JSON.stringify(good)); f(c); return parseLog(c); };
  expect(bad((l) => { l.head = 99; })).toBeNull(); expect(bad((l) => { l.current = 'nope'; })).toBeNull(); expect(bad((l) => { l.branches.main.ops[0].kind = 'weird'; })).toBeNull(); expect(bad((l) => { delete l.branches.main.ops[0].after; })).toBeNull();
  expect(bad((l) => { l.branches.main.ops[2].def.w = -1; })).toBeNull(); expect(bad((l) => { l.branches.main.ops[1].rec = -1; })).toBeNull(); expect(bad((l) => { l.branches.x = { parent: 'x', at: 0, ops: [] }; })).toBeNull(); expect(bad((l) => { l.branches.main.parent = 'main'; })).toBeNull();
  expect(parseLog(null)).toBeNull(); expect(parseLog({ branches: [] , current: 'main', head: 0 })).toBeNull(); expect(parseOp({ kind: 'group', label: 'g', ops: [{ kind: 'group', label: 'g', ops: [{ kind: 'group', label: 'g', ops: [{ kind: 'group', label: 'g', ops: [{ kind: 'group', label: 'g', ops: [] }] }] }] }] })).toBeNull();
  const { st, m } = memory(); m['swift-canvas.doc.v1:p'] = '{"frames":[' + JSON.stringify(fr) + '],"log":{"branches":{}}}'; expect(loadLog(st, 'p')).toBeNull(); expect(loadDoc(st, 'p')).toEqual([fr]);
});
test('fitLog drops the OLDEST steps past the budget and keeps the head on the same op; a small log is untouched', () => {
  const small = sampleLog(); expect(fitLog(small)).toBe(small);
  let l = L.emptyLog(); for (let i = 0; i < MAX_LOG_OPS + 5; i++) l = L.push(l, { kind: 'set', frame: 'tv', el: 'e', prop: 'p', before: String(i), after: String(i + 1) });
  l = L.undo(l).log; const f = fitLog(l); expect(f.branches.main!.ops).toHaveLength(MAX_LOG_OPS); expect(f.head).toBe(MAX_LOG_OPS - 1); expect(L.lastApplied(f)).toEqual(L.lastApplied(l)); expect(L.nextRedo(f)).toEqual(L.nextRedo(l));
});
