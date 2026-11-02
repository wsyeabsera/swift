import { expect, test } from 'vitest';
import { MAX_HISTORY, pushHistory, step } from './history';
test('push trims, skips empties and immediate repeats, and caps', () => {
  expect(pushHistory([], '  a ')).toEqual(['a']); expect(pushHistory(['a'], 'a')).toEqual(['a']); expect(pushHistory(['a'], '  ')).toEqual(['a']); expect(pushHistory(['a', 'b'], 'a')).toEqual(['a', 'b', 'a']);
  let h: string[] = []; for (let i = 0; i < MAX_HISTORY + 5; i++) h = pushHistory(h, `r${i}`); expect(h.length).toBe(MAX_HISTORY); expect(h[0]).toBe('r5');
});
test('up walks back and stops at the oldest, down returns to the draft', () => {
  const h = ['a', 'b', 'c']; let r = step(h, 3, -1, 'draft'); expect(r).toEqual({ pos: 2, text: 'c' }); r = step(h, r.pos, -1, 'draft'); r = step(h, r.pos, -1, 'draft'); expect(r).toEqual({ pos: 0, text: 'a' }); expect(step(h, 0, -1, 'draft')).toEqual({ pos: 0, text: 'a' });
  expect(step(h, 2, 1, 'draft')).toEqual({ pos: 3, text: 'draft' }); expect(step(h, 3, 1, 'draft')).toEqual({ pos: 3, text: 'draft' }); expect(step([], 0, -1, 'x')).toEqual({ pos: 0, text: 'x' });
});
