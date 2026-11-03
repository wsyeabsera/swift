import { expect, test } from 'vitest';
import { kitColors, loadBrand, saveBrand, toBrandTokens } from './brand';
import { BRAND_TOKENS } from './say/say';
test('only plain custom properties pass; junk, injection and duplicates are dropped; capped at 64', () => {
  const t = toBrandTokens([{ name: '--ac', value: '#0a84ff' }, { name: 'color', value: 'red' }, { name: '--x', value: 'red; background:url(x)' }, { name: '--y', value: '<script>' }, { name: '--ac', value: '#fff' }, { name: '--ok', value: ' #30d158 ' }, { name: '--long', value: 'a'.repeat(61) }]);
  expect(t).toEqual({ '--ac': '#0a84ff', '--ok': '#30d158' }); expect(Object.keys(toBrandTokens(Array.from({ length: 80 }, (_, i) => ({ name: `--t${i}`, value: '#000' })))).length).toBe(64);
});
test('round trip; missing, corrupt, empty-after-filter and throwing storage fall back to the tvdash kit', () => {
  const m: Record<string, string> = {}; const st = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } };
  expect(loadBrand(st)).toEqual(BRAND_TOKENS); expect(saveBrand({ '--ac': '#f00' }, st)).toBeNull(); expect(loadBrand(st)).toEqual({ '--ac': '#f00' });
  m['swift-canvas.brand.v1'] = '{bad'; expect(loadBrand(st)).toEqual(BRAND_TOKENS); m['swift-canvas.brand.v1'] = '{"x":"y"}'; expect(loadBrand(st)).toEqual(BRAND_TOKENS);
  expect(loadBrand({ getItem: () => { throw new Error('b'); } })).toEqual(BRAND_TOKENS); expect(saveBrand({}, { setItem: () => { throw new Error('quota'); } })).toBe('quota'); expect(saveBrand({}, undefined)).toBe('storage unavailable');
});
test('brand is per project', () => { const m: Record<string, string> = {}; const st = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } }; saveBrand({ '--ac': '#111' }, st, 'radar'); expect(loadBrand(st, 'radar')).toEqual({ '--ac': '#111' }); expect(loadBrand(st)).toEqual(BRAND_TOKENS); expect(loadBrand(st, 'other')).toEqual(BRAND_TOKENS); });
test('kit colours: only colour values, capped', () => { expect(kitColors({ '--a': '#fff', '--f': 'Inter', '--b': 'rgb(1,2,3)', '--c': '12px' })).toEqual(['#fff', 'rgb(1,2,3)']); expect(kitColors({ '--a': '#111', '--b': '#222', '--c': '#333' }, 2)).toEqual(['#111', '#222']); expect(kitColors({})).toEqual([]); });

import { isColorValue, replaceColor } from './brand';
test('editing a colour token rewrites exact literals only', () => {
  expect(replaceColor('<p style="color:#FFF;background:#ffffff;border:1px solid #fff">x</p>', '#fff', '#0f0')).toEqual({ html: '<p style="color:#0f0;background:#ffffff;border:1px solid #0f0">x</p>', count: 2 });
  expect(replaceColor('a{color:rgba(0, 0, 0, .5)}', 'rgba(0, 0, 0, .5)', '#111').html).toBe('a{color:#111}');
  expect(replaceColor('x', '24px', '30px').count).toBe(0); expect(replaceColor('#abc', '#abc', '#abc').count).toBe(0); expect(replaceColor('#abc', '#abc', 'javascript:1').count).toBe(0);
  expect(isColorValue('oklch(.5 .1 30)')).toBe(true); expect(isColorValue('Inter')).toBe(false);
});

import { compareKits, shareToken } from './brand';
test('sharing copies one validated token and respects the size cap', () => {
  expect(shareToken({ '--a': '#111' }, '--ac', '#0a84ff')).toEqual({ ok: true, kit: { '--a': '#111', '--ac': '#0a84ff' } });
  expect(shareToken({ '--ac': '#000' }, '--ac', '#fff')).toEqual({ ok: true, kit: { '--ac': '#fff' } }); // replaces, no cap issue
  expect(shareToken({}, 'ac', '#fff').ok).toBe(false); expect(shareToken({}, '--x', 'url(javascript:1);{}').ok).toBe(false);
  const full = Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`--t${i}`, '#000'])); expect(shareToken(full, '--new', '#fff')).toMatchObject({ ok: false });
});
test('kits compare by name', () => { expect(compareKits({ '--a': '#FFF', '--b': '1', '--c': '2' }, { '--a': '#fff', '--b': '9', '--d': '3' }).map((r) => `${r.name}:${r.state}`)).toEqual(['--a:same', '--b:differs', '--c:only-a', '--d:only-b']); });
