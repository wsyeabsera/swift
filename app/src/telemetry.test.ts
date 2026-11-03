import { expect, test } from 'vitest';
import { addRecord, loadRecords, markUndone, MAX_RECORDS, percentile, sanitizeRecords, saveRecords, summarize, type Rec } from './telemetry';
const base = { at: 1, tier: 'claude' as const, skill: 'say', model: 'haiku', ok: true };
test('nearest-rank percentiles; empty is 0', () => {
  expect(percentile([], 50)).toBe(0); expect(percentile([5], 95)).toBe(5); const v = Array.from({ length: 20 }, (_, i) => (i + 1) * 10); expect(percentile(v, 50)).toBe(100); expect(percentile(v, 95)).toBe(190); expect(percentile([3, 1, 2], 50)).toBe(2);
});
test('records get increasing ids, cap at 500, and an undo marks exactly one', () => {
  let list: Rec[] = []; let id = 0; for (let i = 0; i < MAX_RECORDS + 3; i++) { const r = addRecord(list, { ...base, ms: i }); list = r.list; id = r.id; }
  expect(list).toHaveLength(MAX_RECORDS); expect(list.at(-1)!.id).toBe(MAX_RECORDS + 3); expect(id).toBe(MAX_RECORDS + 3);
  const m = markUndone(list, id); expect(m.filter((r) => r.undone).map((r) => r.id)).toEqual([id]); expect(markUndone(m, id, false).some((r) => r.undone)).toBe(false);
});
test('summary: p50/p95 per skill and tier from successes only; failures and undos are counted', () => {
  let l: Rec[] = []; for (const ms of [10, 20, 30, 40]) l = addRecord(l, { ...base, tier: 'local', skill: 'local', model: 'rules', ms }).list;
  for (const ms of [1000, 2000, 3000]) l = addRecord(l, { ...base, ms }).list; l = addRecord(l, { ...base, ms: 99999, ok: false }).list; l = markUndone(l, l[4]!.id);
  const s = summarize(l); expect(s.map((x) => `${x.tier}/${x.skill}`)).toEqual(['claude/say', 'local/local']);
  expect(s[0]).toEqual({ skill: 'say', tier: 'claude', n: 4, p50: 2000, p95: 3000, failed: 1, undone: 1 }); expect(s[1]).toMatchObject({ n: 4, p50: 20, p95: 40, failed: 0, undone: 0 }); expect(summarize([])).toEqual([]);
});
test('storage: round trip; junk dropped; corrupt and throwing storage are safe', () => {
  const m: Record<string, string> = {}; const st = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } }; const l = addRecord([], { ...base, ms: 5 }).list;
  expect(saveRecords(l, st)).toBeNull(); expect(loadRecords(st)).toEqual(l); expect(sanitizeRecords([...l, { id: 9, tier: 'x' }, null, 'a', { ...l[0], ms: -1 }])).toEqual(l);
  m['swift-canvas.telemetry.v1'] = '{bad'; expect(loadRecords(st)).toEqual([]); expect(loadRecords({ getItem: () => { throw new Error('b'); } })).toEqual([]); expect(saveRecords(l, { setItem: () => { throw new Error('quota'); } })).toBe('quota'); expect(saveRecords(l, undefined)).toBe('storage unavailable');
});
import { flags } from './telemetry';
test('flags: slow past the tier budget, often undone at >= 30% of 5+ edits; small samples never flag', () => {
  const s = (o: Partial<Parameters<typeof flags>[0]>) => ({ skill: 'say', tier: 'claude' as const, n: 10, p50: 1000, p95: 2000, failed: 0, undone: 0, ...o });
  expect(flags(s({}))).toEqual([]); expect(flags(s({ p95: 9000 }))).toEqual(['slow']); expect(flags(s({ undone: 3 }))).toEqual(['often undone']); expect(flags(s({ p95: 9000, undone: 5 }))).toEqual(['slow', 'often undone']);
  expect(flags(s({ n: 4, p95: 99999, undone: 4 }))).toEqual([]); expect(flags(s({ tier: 'local', p95: 60 }))).toEqual(['slow']);
});

import { sanitizeRecords as san } from './telemetry';
test('history fields survive storage; oversized prompts and junk numbers are dropped, the record stays', () => {
  const base = { id: 1, at: 1, tier: 'claude', skill: 'say', model: 'm', ms: 5, ok: true, undone: false };
  expect(san([{ ...base, prompt: 'make it bigger', rejected: 1, firstMs: 900 }])[0]).toMatchObject({ prompt: 'make it bigger', rejected: 1, firstMs: 900 });
  expect(san([{ ...base, prompt: 'x'.repeat(201), rejected: -3, firstMs: 'a' }])[0]).toEqual(base);
});
