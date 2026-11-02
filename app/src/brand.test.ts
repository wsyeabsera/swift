import { expect, test } from 'vitest';
import { kitColors, loadBrand, saveBrand, toBrandTokens } from './brand';
import { BRAND_TOKENS } from './say/say';
test('only plain custom properties pass; junk, injection and duplicates are dropped; capped at 16', () => {
  const t = toBrandTokens([{ name: '--ac', value: '#0a84ff' }, { name: 'color', value: 'red' }, { name: '--x', value: 'red; background:url(x)' }, { name: '--y', value: '<script>' }, { name: '--ac', value: '#fff' }, { name: '--ok', value: ' #30d158 ' }, { name: '--long', value: 'a'.repeat(61) }]);
  expect(t).toEqual({ '--ac': '#0a84ff', '--ok': '#30d158' }); expect(Object.keys(toBrandTokens(Array.from({ length: 40 }, (_, i) => ({ name: `--t${i}`, value: '#000' })))).length).toBe(16);
});
test('round trip; missing, corrupt, empty-after-filter and throwing storage fall back to the tvdash kit', () => {
  const m: Record<string, string> = {}; const st = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } };
  expect(loadBrand(st)).toEqual(BRAND_TOKENS); expect(saveBrand({ '--ac': '#f00' }, st)).toBeNull(); expect(loadBrand(st)).toEqual({ '--ac': '#f00' });
  m['swift-canvas.brand.v1'] = '{bad'; expect(loadBrand(st)).toEqual(BRAND_TOKENS); m['swift-canvas.brand.v1'] = '{"x":"y"}'; expect(loadBrand(st)).toEqual(BRAND_TOKENS);
  expect(loadBrand({ getItem: () => { throw new Error('b'); } })).toEqual(BRAND_TOKENS); expect(saveBrand({}, { setItem: () => { throw new Error('quota'); } })).toBe('quota'); expect(saveBrand({}, undefined)).toBe('storage unavailable');
});
test('brand is per project', () => { const m: Record<string, string> = {}; const st = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } }; saveBrand({ '--ac': '#111' }, st, 'radar'); expect(loadBrand(st, 'radar')).toEqual({ '--ac': '#111' }); expect(loadBrand(st)).toEqual(BRAND_TOKENS); expect(loadBrand(st, 'other')).toEqual(BRAND_TOKENS); });
test('kit colours: only colour values, capped', () => { expect(kitColors({ '--a': '#fff', '--f': 'Inter', '--b': 'rgb(1,2,3)', '--c': '12px' })).toEqual(['#fff', 'rgb(1,2,3)']); expect(kitColors({ '--a': '#111', '--b': '#222', '--c': '#333' }, 2)).toEqual(['#111', '#222']); expect(kitColors({})).toEqual([]); });
