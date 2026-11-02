import { expect, test } from 'vitest';
import { ACCENTS, BACKDROP_KEYS, computeTheme, DEFAULT_THEME, GLASSES, loadTheme, sanitize, saveTheme, type ThemeChoice } from './theme';
const REQUIRED = ['--tx', '--mu', '--glass', '--bd', '--sh', '--field', '--chipOn', '--veil', '--base', '--blur', '--rim', '--ac', '--acInk', '--bg-image', '--sheen'];
test('every backdrop x mode x glass x accent gives every variable', () => {
  for (const bd of BACKDROP_KEYS) for (const mode of ['dark', 'light', 'auto'] as const) for (const glass of Object.keys(GLASSES) as (keyof typeof GLASSES)[]) { const { vars } = computeTheme({ bd, mode, accent: 'Mint', glass }); for (const k of REQUIRED) expect(vars[k], `${bd}/${mode}/${glass} ${k}`).toBeTruthy(); }
});
test('auto follows the photo: light photos get light mode, dark photos dark', () => { expect(computeTheme({ ...DEFAULT_THEME, bd: 'lake', mode: 'auto' }).mode).toBe('light'); expect(computeTheme({ ...DEFAULT_THEME, bd: 'milkyway', mode: 'auto' }).mode).toBe('dark'); expect(computeTheme({ ...DEFAULT_THEME, bd: 'lake', mode: 'dark' }).mode).toBe('dark'); });
test('the tuned contrast values are in place (dark tint 0.64 + 0.12 on light photos, thin has the weaker rim)', () => {
  expect(computeTheme({ bd: 'milkyway', mode: 'dark', accent: 'Mint', glass: 'thin' }).vars['--glass']).toContain('rgba(12,14,20,0.64)');
  expect(computeTheme({ bd: 'lake', mode: 'dark', accent: 'Mint', glass: 'regular' }).vars['--glass']).toContain('rgba(12,14,20,1.00)'); // 0.64 + 0.12 + 0.20 + 0.04, clamped
  expect(computeTheme({ bd: 'lake', mode: 'dark', accent: 'Mint', glass: 'regular' }).vars['--mu']).toBe('#F5F7FA'); expect(computeTheme({ bd: 'milkyway', mode: 'dark', accent: 'Mint', glass: 'regular' }).vars['--mu']).toBe('#E4E8EF');
  expect(computeTheme({ ...DEFAULT_THEME, glass: 'thin' }).vars['--rim']).toBe('0.7'); expect(computeTheme({ ...DEFAULT_THEME, glass: 'thick' }).vars['--rim']).toBe('1');
});
test('sheen is weaker only on dark glass over bright or saturated backdrops', () => { expect(computeTheme({ ...DEFAULT_THEME, bd: 'glass', mode: 'dark' }).vars['--sheen']).toBe('0.45'); expect(computeTheme({ ...DEFAULT_THEME, bd: 'mesh', mode: 'dark' }).vars['--sheen']).toBe('0.45'); expect(computeTheme({ ...DEFAULT_THEME, bd: 'milkyway', mode: 'dark' }).vars['--sheen']).toBe('1'); expect(computeTheme({ ...DEFAULT_THEME, bd: 'glass', mode: 'light' }).vars['--sheen']).toBe('1'); });
test('accent ink: the accent itself in dark mode, the darker ink in light mode (readable text)', () => { expect(computeTheme({ ...DEFAULT_THEME, mode: 'dark', accent: 'Iris' }).vars['--acInk']).toBe(ACCENTS.Iris.hex); expect(computeTheme({ ...DEFAULT_THEME, mode: 'light', accent: 'Iris' }).vars['--acInk']).toBe(ACCENTS.Iris.ink); });
test('sanitize: junk from storage can never produce an invalid theme', () => {
  expect(sanitize(null)).toEqual(DEFAULT_THEME); expect(sanitize('x')).toEqual(DEFAULT_THEME); expect(sanitize({ bd: 'nope', mode: 7, accent: {}, glass: 'huge' })).toEqual(DEFAULT_THEME); expect(sanitize({ bd: 'fuji', glass: 'thick' })).toEqual({ ...DEFAULT_THEME, bd: 'fuji', glass: 'thick' });
});
test('persistence: round trip, corrupt data, and storage that throws', () => {
  const mem: Record<string, string> = {}; const st = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } }; const t: ThemeChoice = { bd: 'dunes', mode: 'light', accent: 'Coral', glass: 'thin' };
  saveTheme(t, st); expect(loadTheme(st)).toEqual(t); mem['swift-canvas.theme'] = '{broken'; expect(loadTheme(st)).toEqual(DEFAULT_THEME);
  const boom = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } }; expect(loadTheme(boom)).toEqual(DEFAULT_THEME); expect(() => saveTheme(t, boom)).not.toThrow();
});
