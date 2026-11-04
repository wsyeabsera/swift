import { expect, test } from 'vitest';
import { AURORA, BUDGET, effectMs, meter, suggest, type Effect } from './effects';
test('the TV calibration point: a native full-screen gradient is 150 ms', () => expect(effectMs({ kind: 'gradient', scale: 1, fps: 30 }, 'tv')).toBeCloseTo(150, 5));
test('the aurora at quarter resolution is 13-19 ms on the TV budget and passes', () => { const m = meter(AURORA, 'tv'); expect(m.frameMs).toBeGreaterThanOrEqual(13); expect(m.frameMs).toBeLessThanOrEqual(19); expect(m.over).toBe(false); expect(suggest(AURORA, 'tv')).toBeNull(); });
test('a heavier stack is over budget and the suggestion fits', () => {
  const heavy: Effect[] = [{ kind: 'gradient', scale: 1, fps: 30 }, { kind: 'blur', scale: 0.5, fps: 30 }]; const m = meter(heavy, 'tv'); expect(m.over).toBe(true); expect(m.reason).toMatch(/ms per update/);
  const s = suggest(heavy, 'tv')!; expect(s).not.toBeNull(); expect(meter(s.stack, 'tv').over).toBe(false); expect(s.text).toMatch(/scale/); expect(heavy[0]!.scale).toBe(1); // the input is not mutated
});
test('sustained load can fail even when one update fits: scale first, then the update rate', () => {
  const s: Effect[] = [{ kind: 'gradient', scale: 0.25, fps: 60 }, { kind: 'gradient', scale: 0.25, fps: 60 }]; expect(meter(s, 'tv').reason).toMatch(/GPU/); expect(suggest(s, 'tv')!.text).toMatch(/scale/);
  const tiny: Effect[] = Array.from({ length: 6 }, () => ({ kind: 'gradient', scale: 0.125, fps: 60 }) as Effect); expect(meter(tiny, 'tv').over).toBe(true); const g = suggest(tiny, 'tv')!; expect(g.text).toMatch(/updates to/); expect(meter(g.stack, 'tv').over).toBe(false);
});
test('the same stack costs far less on a phone than 150 ms-class TV gradients; budgets exist for every device', () => { expect(meter(AURORA, 'phone').frameMs).toBeLessThan(meter(AURORA, 'tv').frameMs); for (const d of ['tv', 'phone', 'desktop'] as const) expect(BUDGET[d].frameMs).toBeGreaterThan(0); });
test('an impossible stack returns no suggestion instead of looping', () => expect(suggest(Array.from({ length: 40 }, () => ({ kind: 'blur', scale: 1, fps: 60 }) as Effect), 'tv')).toBeNull());
import { fxHtml, fxId, parseFx, FX_PRESETS } from './effects';
test('an effect layer round-trips through its markup, so the meter reads the real frame', () => {
  const e: Effect = { kind: 'gradient', scale: 0.25, fps: 15 }; const h = fxHtml('fx-gradient-1', e); expect(h).toContain('pointer-events:none'); expect(h).toContain('steps(180)'); expect(h).toContain('width:25.00%'); expect(h).toContain('scale(4.000)');
  expect(parseFx(`<div id="tv">${h}${fxHtml('fx-blur-1', { kind: 'blur', scale: 1, fps: 30 })}</div>`)).toEqual([{ id: 'fx-gradient-1', effect: e, on: true }, { id: 'fx-blur-1', effect: { kind: 'blur', scale: 1, fps: 30 }, on: true }]);
  expect(parseFx('<div id="x" data-fx="gradient" data-fx-scale="9" data-fx-fps="15">')).toEqual([]); expect(parseFx('<div id="tv"></div>')).toEqual([]);
});
test('a frame with the shipped aurora preset is within the TV budget; the heavy preset is not', () => {
  const stack = (k: 'aurora' | 'heavy') => parseFx(FX_PRESETS[k].map((e, i) => fxHtml(`fx-${e.kind}-${i + 1}`, e)).join('')).map((x) => x.effect);
  expect(meter(stack('aurora'), 'tv').over).toBe(false); expect(meter(stack('heavy'), 'tv').over).toBe(true);
});
test('fxId picks the next free id and the settings are clamped to a sane scale', () => {
  expect(fxId('', 'noise')).toBe('fx-noise-1'); expect(fxId('<i id="fx-noise-1"></i><i id="fx-noise-2"></i>', 'noise')).toBe('fx-noise-3'); expect(fxHtml('a', { kind: 'noise', scale: 0, fps: 10 })).toContain('data-fx-scale="0.05"');
});

test('parseFx marks a layer switched off (display:none) and keeps it in the list', async () => {
  const { fxHtml, parseFx } = await import('./effects'); const on = fxHtml('fx-gradient-1', { kind: 'gradient', scale: 0.5, fps: 15 }); const off = fxHtml('fx-noise-1', { kind: 'noise', scale: 0.5, fps: 15 }).replace('style="', 'style="display:none;');
  const r = parseFx(`<div id="x">${on}${off}</div>`); expect(r.map((x) => [x.id, x.on])).toEqual([['fx-gradient-1', true], ['fx-noise-1', false]]);
});
