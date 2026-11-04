import { expect, test } from 'vitest';
import { altKey, count, cycle, keepOne, MAX_VARIANTS, saveVariant, type Alts } from './alternates';
const k = altKey('tv', 'clock');
const add = (a: Alts, h: string): Alts => { const r = saveVariant(a, k, h); if (!r.ok) throw new Error(r.error); return r.alts; };
test('variants are saved in order, the newest becomes current, a duplicate of the current is refused', () => {
  let a = add({}, '<b id="clock">1</b>'); a = add(a, '<b id="clock">2</b>'); expect(count(a, k)).toBe(2); expect(a[k]!.at).toBe(1); expect(saveVariant(a, k, '<b id="clock">2</b>')).toMatchObject({ ok: false });
  expect(saveVariant({}, k, '  ')).toMatchObject({ ok: false }); expect(saveVariant({}, k, 'x'.repeat(200_001))).toMatchObject({ ok: false });
});
test('cycling wraps both ways and needs two variants', () => {
  expect(cycle({}, k)).toBeNull(); const one = add({}, 'a'); expect(cycle(one, k)).toBeNull();
  let a = add(add(add({}, 'a'), 'b'), 'c'); expect(a[k]!.at).toBe(2); const n = cycle(a, k)!; expect([n.html, n.index, n.of]).toEqual(['a', 0, 3]); a = n.alts; expect(cycle(a, k, -1)!.html).toBe('c'); expect(cycle(a, k)!.html).toBe('b');
});
test('a ninth variant is refused, keep one clears the rest, other elements are separate', () => {
  let a: Alts = {}; for (let i = 0; i < MAX_VARIANTS; i++) a = add(a, `v${i}`); expect(saveVariant(a, k, 'extra')).toMatchObject({ ok: false, error: expect.stringMatching(/keep one/) });
  const b = { ...a, [altKey('tv', 'date')]: { variants: ['d1', 'd2'], at: 0 } }; const kept = keepOne(b, k); expect(kept[k]).toBeUndefined(); expect(count(kept, altKey('tv', 'date'))).toBe(2); expect(b[k]).toBeDefined();
});
