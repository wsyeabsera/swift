import { expect, test } from 'vitest';
import { ease, EASES, emptyTimeline, mix, parseTimeline, removeKey, sample, setEase, setKey, valueAt, type Timeline, type Track } from './motion';
const tr = (keys: Track['keys']): Track => ({ frame: 'tv', el: 'card', prop: 'opacity', keys });
test('every ease starts at 0, ends at 1 and stays finite (back.out may overshoot)', () => { for (const e of EASES) { expect(ease(e, 0)).toBeCloseTo(0, 5); expect(ease(e, 1)).toBeCloseTo(1, 5); for (let p = 0; p <= 1; p += 0.05) expect(Number.isFinite(ease(e, p))).toBe(true); } expect(ease('back.out', 0.7)).toBeGreaterThan(1); });
test('expo.out is fast first, expo.in slow first; inOut is symmetric', () => { expect(ease('expo.out', 0.2)).toBeGreaterThan(0.7); expect(ease('expo.in', 0.2)).toBeLessThan(0.01); expect(ease('cubic.inOut', 0.5)).toBeCloseTo(0.5, 5); expect(ease('quad.inOut', 0.25) + ease('quad.inOut', 0.75)).toBeCloseTo(1, 5); });
test('numbers keep their unit, colours blend, other values hold', () => { expect(mix('0px', '100px', 0.25)).toBe('25px'); expect(mix('0', '1', 0.5)).toBe('0.5'); expect(mix('#000', '#fff', 0.5)).toBe('rgba(128, 128, 128, 1)'); expect(mix('10px', '2em', 0.5)).toBe('10px'); expect(mix('flex', 'none', 0.99)).toBe('flex'); expect(mix('flex', 'none', 1)).toBe('none'); });
test('lists blend part by part (translate, scale); mismatched or unmixable lists hold', () => { expect(mix('400px 0px', '0px 0px', 0.25)).toBe('300px 0px'); expect(mix('1 1', '2 3', 0.5)).toBe('1.5 2'); expect(mix('rgb(0, 0, 0) 0px', 'rgb(255, 255, 255) 10px', 0.5)).toBe('rgba(128, 128, 128, 1) 5px'); expect(mix('10px 5px', '20px', 0.5)).toBe('10px 5px'); expect(mix('a b', 'c d', 0.5)).toBe('a b'); expect(mix('a b', 'c d', 1)).toBe('c d'); });
test('valueAt clamps outside the keys and eases inside a segment', () => { const t = tr([{ t: 0, v: '0', ease: 'linear' }, { t: 1000, v: '1', ease: 'linear' }]); expect(valueAt(t, -5)).toBe('0'); expect(valueAt(t, 500)).toBe('0.5'); expect(valueAt(t, 9999)).toBe('1'); expect(valueAt(tr([]), 0)).toBeNull(); const e = tr([{ t: 0, v: '0', ease: 'expo.out' }, { t: 1000, v: '1', ease: 'linear' }]); expect(parseFloat(valueAt(e, 200)!)).toBeGreaterThan(0.7); });
test('setKey sorts, replaces a key within 1 ms, clamps time to the duration and enforces limits', () => {
  let tl: Timeline = emptyTimeline(1000); for (const [t, v] of [[800, '1'], [0, '0'], [400, '0.5'], [400.4, '0.6'], [5000, '9']] as const) { const r = setKey(tl, 'tv', 'card', 'opacity', t, v); if (!r.ok) throw new Error(r.error); tl = r.tl; }
  expect(tl.tracks[0]!.keys.map((k) => [k.t, k.v])).toEqual([[0, '0'], [400, '0.6'], [800, '1'], [1000, '9']]);
  expect(setKey(tl, 'tv', 'card', 'opacity', NaN, '1')).toMatchObject({ ok: false }); expect(setKey(tl, 'tv', 'card', 'opacity', 1, '')).toMatchObject({ ok: false });
  let big = emptyTimeline(); for (let i = 0; i < 100; i++) big = (setKey(big, 'f', 'e', 'p', i * 10, String(i)) as { tl: Timeline }).tl; expect(setKey(big, 'f', 'e', 'p', 5, '5')).toMatchObject({ ok: false, error: expect.stringMatching(/keyframes/) });
});
test('sample returns every track at t, filtered by frame', () => { let tl = emptyTimeline(); tl = (setKey(tl, 'tv', 'a', 'opacity', 0, '0') as { tl: Timeline }).tl; tl = (setKey(tl, 'tv', 'a', 'opacity', 1000, '1') as { tl: Timeline }).tl; tl = (setKey(tl, 'ph', 'b', 'left', 0, '0px') as { tl: Timeline }).tl; expect(sample(tl, 500, 'tv')).toEqual([{ frame: 'tv', el: 'a', prop: 'opacity', value: '0.5' }]); expect(sample(tl, 0)).toHaveLength(2); });
test('setEase changes the eases of an element ("make it ease out"); removeKey drops empty tracks', () => {
  let tl = emptyTimeline(); tl = (setKey(tl, 'tv', 'a', 'opacity', 0, '0') as { tl: Timeline }).tl; tl = (setKey(tl, 'tv', 'a', 'opacity', 1000, '1') as { tl: Timeline }).tl;
  const e = setEase(tl, 'tv', 'a', 'expo.out'); expect(e.tracks[0]!.keys.map((k) => k.ease)).toEqual(['expo.out', 'linear']); expect(tl.tracks[0]!.keys[0]!.ease).toBe('linear');
  expect(removeKey(removeKey(tl, 'tv', 'a', 'opacity', 0), 'tv', 'a', 'opacity', 1000).tracks).toEqual([]);
});
test('parseTimeline keeps what is valid and drops the rest; garbage is null', () => {
  expect(parseTimeline(null)).toBeNull(); expect(parseTimeline({ duration: -1, tracks: [] })).toBeNull(); expect(parseTimeline({ duration: 1000 })).toBeNull();
  const t = parseTimeline({ duration: 1000, tracks: [{ frame: 'tv', el: 'a', prop: 'opacity', keys: [{ t: 0, v: '0', ease: 'linear' }, { t: 0, v: 'dup', ease: 'linear' }, { t: 2000, v: 'late', ease: 'linear' }, { t: 5, v: 'x', ease: 'bounce' }, { t: 500, v: '1', ease: 'expo.out' }] }, { frame: 'tv', el: 'a', prop: 'opacity', keys: [] }, { nope: 1 }] });
  expect(t!.tracks).toHaveLength(1); expect(t!.tracks[0]!.keys.map((k) => k.t)).toEqual([0, 500]);
});
