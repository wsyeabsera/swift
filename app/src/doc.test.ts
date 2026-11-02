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
