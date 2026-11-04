import { expect, test } from 'vitest';
import { layoutTimeline } from './timelineLayout';
import type { Timeline } from './motion';
const tl = (tracks: Timeline['tracks'], duration = 2400): Timeline => ({ duration, tracks });
test('rows get a bar from the first to the last key and a diamond per key, as percentages of the timeline', () => {
  const l = layoutTimeline(tl([{ frame: 'tv', el: 'panel', prop: 'opacity', keys: [{ t: 0, v: '0', ease: 'linear' }, { t: 1200, v: '1', ease: 'expo.out' }] }]), 600);
  expect(l.rows).toHaveLength(1); expect(l.rows[0]!.bar).toEqual({ left: 0, width: 50 }); expect(l.rows[0]!.keys.map((k) => k.left)).toEqual([0, 50]); expect(l.rows[0]!.sub).toBe('opacity 0 → 1'); expect(l.playhead).toBe(25);
});
test('the ruler ticks from 0 to the end and the end grows to the last key when keys run past the duration', () => {
  const l = layoutTimeline(tl([{ frame: 'a', el: 'b', prop: 'left', keys: [{ t: 0, v: '0px', ease: 'linear' }, { t: 5000, v: '9px', ease: 'linear' }] }], 1000), 0);
  expect(l.end).toBe(5000); expect(l.ruler[0]).toEqual({ left: 0, label: '0s' }); expect(l.ruler[l.ruler.length - 1]!.left).toBeLessThanOrEqual(100);
});
test('an empty timeline has no rows, the playhead is clamped, a zero-length bar stays visible', () => {
  expect(layoutTimeline(tl([]), 99999).rows).toEqual([]); expect(layoutTimeline(tl([]), 99999).playhead).toBe(100);
  const one = layoutTimeline(tl([{ frame: 'a', el: 'b', prop: 'opacity', keys: [{ t: 500, v: '1', ease: 'linear' }] }]), 0); expect(one.rows[0]!.bar.width).toBeGreaterThan(0);
});
