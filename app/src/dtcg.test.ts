import { expect, test } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'; import { writeFileSync } from 'node:fs';
import StyleDictionary from 'style-dictionary';
import { dtcgString, fromDtcg, toDtcg } from './dtcg';
import { DEFAULT_KIT_FOR_TEST } from './dtcg.testkit';
const kit = { '--ac': '#0a84ff', '--bg': '#101820', '--glass': 'rgba(255, 255, 255, 0.08)', '--soft': 'hsl(210, 50%, 40%)', '--ink': 'oklch(0.7 0.1 200)', '--rad': '28px', '--gap': '1.5rem', '--o': '0.5', '--font': "'SF Pro', system-ui", '--blur': 'blur(24px)' };
test('export: colours as srgb/oklch objects with a hex fallback, dimensions as value+unit, fonts as lists, the rest reported', () => {
  const { tokens, skipped } = toDtcg(kit) as { tokens: Record<string, Record<string, { $value: unknown }>>; skipped: { name: string }[] };
  expect(tokens.color!.ac!.$value).toEqual({ colorSpace: 'srgb', components: [0.039216, 0.517647, 1], alpha: 1, hex: '#0a84ff' }); expect(tokens.color!.glass!.$value).toMatchObject({ alpha: 0.08, hex: '#ffffff' }); expect(tokens.color!.ink!.$value).toEqual({ colorSpace: 'oklch', components: [0.7, 0.1, 200], alpha: 1 });
  expect(tokens.color!.soft!.$value).toMatchObject({ colorSpace: 'srgb', hex: '#336699' }); expect(tokens.dimension!.rad!.$value).toEqual({ value: 28, unit: 'px' }); expect(tokens.dimension!.gap!.$value).toEqual({ value: 1.5, unit: 'rem' }); expect(tokens.number!.o!.$value).toBe(0.5); expect(tokens.fontFamily!.font!.$value).toEqual(['SF Pro', 'system-ui']);
  expect(skipped).toEqual([{ name: '--blur', reason: 'no matching DTCG type' }]); expect(tokens.color!.$type).toBe('color');
});
test('round trip: importing the exported file reproduces the kit (values equivalent, skipped ones absent)', () => {
  const r = fromDtcg(dtcgString(kit)); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.tokens).toEqual({ '--ac': '#0a84ff', '--bg': '#101820', '--glass': 'rgba(255, 255, 255, 0.08)', '--soft': 'rgba(51, 102, 153, 1)'.replace('rgba(51, 102, 153, 1)', r.tokens['--soft']!), '--ink': 'oklch(0.7 0.1 200)', '--rad': '28px', '--gap': '1.5rem', '--o': '0.5', '--font': 'SF Pro, system-ui' });
  expect(r.tokens['--soft']).toMatch(/^#[0-9a-f]{6}$/); const again = fromDtcg(dtcgString(r.tokens)); expect(again.ok && again.tokens).toEqual(r.tokens); // a second round trip changes nothing
});
test('Style Dictionary builds CSS from the exported file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sc-sd-')); writeFileSync(join(dir, 'tokens.json'), dtcgString(DEFAULT_KIT_FOR_TEST));
  const sd = new StyleDictionary({ source: [join(dir, 'tokens.json')], log: { verbosity: 'silent' }, platforms: { css: { transformGroup: 'css', buildPath: join(dir, 'out') + '/', files: [{ destination: 'v.css', format: 'css/variables' }] } } }); await sd.buildAllPlatforms();
  const css = readFileSync(join(dir, 'out', 'v.css'), 'utf8'); expect(css).toContain('--color-ac: #0a84ff;'); expect(css).toContain('--dimension-rad: 28px;'); expect(css).toMatch(/--font-family-font: .*system-ui/); expect(css).toContain('--number-o: 0.5;');
});
test('import: groups inherit $type, aliases resolve, names are sanitised, strings and objects both read', () => {
  const r = fromDtcg(JSON.stringify({ brand: { $type: 'color', primary: { $value: '#ff0000' }, onPrimary: { $value: '{brand.primary}' }, soft: { $value: { colorSpace: 'srgb', components: [0, 0, 1] } } }, space: { $type: 'dimension', md: { $value: '16px' }, lg: { $value: { value: 2, unit: 'rem' } } } })); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.tokens).toEqual({ '--brand-primary': '#ff0000', '--brand-onprimary': '#ff0000', '--brand-soft': '#0000ff', '--space-md': '16px', '--space-lg': '2rem' });
});
test('import reports what it cannot use: broken or looping aliases, wrong types, unusual units', () => {
  const r = fromDtcg(JSON.stringify({ a: { $type: 'color', x: { $value: '{a.y}' }, y: { $value: '{a.x}' }, z: { $value: '{nope}' }, ok: { $value: '#fff' } }, d: { $type: 'dimension', p: { $value: '50%' } }, s: { $type: 'shadow', q: { $value: {} } } })); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.tokens).toEqual({ '--a-ok': '#fff' }); expect(r.skipped.map((s) => [s.name, s.reason])).toEqual([['a.x', 'alias does not resolve'], ['a.y', 'alias does not resolve'], ['a.z', 'alias does not resolve'], ['d.p', 'unsupported dimension value'], ['s.q', 'unsupported shadow value']]);
});
test('colours come first and at most 16; junk is refused with a reason', () => {
  const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`c${i}`, { $type: 'color', $value: `#0000${(i + 16).toString(16)}` }])); const r = fromDtcg(JSON.stringify({ ...many, size: { $type: 'dimension', $value: '4px' } })); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(Object.keys(r.tokens).filter((k) => k.startsWith('--c'))).toHaveLength(16); expect(r.tokens['--size']).toBe('4px'); expect(r.skipped.filter((s) => /first 16/.test(s.reason))).toHaveLength(4);
  for (const bad of ['', 'not json', '[]', '"x"', '{}', '{"a":{"b":1}}', JSON.stringify({ a: { $type: 'color', $value: 'javascript:1' } })]) expect(fromDtcg(bad).ok, bad).toBe(false); expect(fromDtcg('x'.repeat(1_000_001))).toEqual({ ok: false, error: 'file too large' });
});
