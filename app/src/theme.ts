// Theme pipeline: backdrop photo + mode + accent + glass thickness -> CSS variables. Ported from the tuned KIT.md THEME block (design folder), including the
// contrast fixes: dark glass tint 0.64 (+0.12 on light photos), muted text brightened on light photos. `npm run e2e:contrast` checks >= 4.5:1 on every combination.
export type BackdropKey = 'milkyway' | 'aurora' | 'lake' | 'fuji' | 'dunes' | 'glass' | 'manhattan' | 'mesh';
export type Mode = 'dark' | 'light' | 'auto'; export type AccentKey = 'Mint' | 'Iris' | 'Coral' | 'Amber' | 'Sky'; export type GlassKey = 'thin' | 'regular' | 'thick';
export type ThemeChoice = { bd: BackdropKey; mode: Mode; accent: AccentKey; glass: GlassKey };
export const DEFAULT_THEME: ThemeChoice = { bd: 'milkyway', mode: 'dark', accent: 'Mint', glass: 'regular' }; // the look every design board opens in
type Backdrop = { label: string; tint: string; dB: number; lB: number; lightish: boolean; credit: string };
export const BACKDROPS: Record<BackdropKey, Backdrop> = {
  milkyway: { label: 'Milky Way', tint: '#4c4659', dB: 0, lB: 24, lightish: false, credit: 'Pascal Debrunner' },
  aurora: { label: 'Aurora', tint: '#5d6d47', dB: 4, lB: 20, lightish: false, credit: 'Federico Bottos' },
  lake: { label: 'Alpine lake', tint: '#97a3a9', dB: 20, lB: 4, lightish: true, credit: 'Samuel Scrimshaw' },
  fuji: { label: 'Mount Fuji', tint: '#848488', dB: 18, lB: 6, lightish: true, credit: 'Nicolas Jehly' },
  dunes: { label: 'Dunes', tint: '#97755f', dB: 14, lB: 6, lightish: true, credit: 'Unsplash' },
  glass: { label: 'Glass', tint: '#dbbae3', dB: 26, lB: 4, lightish: true, credit: 'Yue Ma' },
  manhattan: { label: 'Manhattan', tint: '#384350', dB: 2, lB: 24, lightish: false, credit: 'Andreas Niendorf' },
  mesh: { label: 'Living mesh', tint: '#2a3a6a', dB: 22, lB: 22, lightish: false, credit: 'generated gradient' },
};
export const BACKDROP_KEYS = Object.keys(BACKDROPS) as BackdropKey[];
export const ACCENTS: Record<AccentKey, { hex: string; ink: string }> = { Mint: { hex: '#7CF0D0', ink: '#0B7A62' }, Iris: { hex: '#9C8CFF', ink: '#4F3FD0' }, Coral: { hex: '#FF9B6B', ink: '#B4481A' }, Amber: { hex: '#FFC53D', ink: '#8A5A00' }, Sky: { hex: '#5BD0FF', ink: '#0B6E99' } };
export const GLASSES: Record<GlassKey, { label: string; blur: string; add: number; rim: number }> = { thin: { label: 'Thin', blur: '14px', add: 0, rim: 0.7 }, regular: { label: 'Regular', blur: '28px', add: 0.04, rim: 1 }, thick: { label: 'Thick', blur: '48px', add: 0.14, rim: 1 } };
const MESH = 'radial-gradient(at 20% 25%, oklch(0.72 0.2 155) 0px, transparent 55%), radial-gradient(at 80% 20%, oklch(0.62 0.22 300) 0px, transparent 55%), radial-gradient(at 65% 80%, oklch(0.7 0.18 200) 0px, transparent 55%), radial-gradient(at 15% 85%, oklch(0.6 0.24 340) 0px, transparent 55%), linear-gradient(oklch(0.3 0.08 260), oklch(0.3 0.08 260))';
export const backdropImage = (k: BackdropKey): string => (k === 'mesh' ? MESH : `url(./bg/${k}.jpg)`);
export const backdropThumb = (k: BackdropKey): string => (k === 'mesh' ? MESH : `url(./bg/${k}-thumb.jpg)`);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);
/** Untrusted input (localStorage) -> a valid choice. */
export function sanitize(raw: unknown): ThemeChoice {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return { bd: pick(o.bd, BACKDROP_KEYS, DEFAULT_THEME.bd), mode: pick(o.mode, ['dark', 'light', 'auto'] as const, DEFAULT_THEME.mode), accent: pick(o.accent, Object.keys(ACCENTS) as AccentKey[], DEFAULT_THEME.accent), glass: pick(o.glass, Object.keys(GLASSES) as GlassKey[], DEFAULT_THEME.glass) };
}
export type ThemeVars = { mode: 'dark' | 'light'; vars: Record<string, string> };
export function computeTheme(t: ThemeChoice): ThemeVars {
  const ph = BACKDROPS[t.bd]; const A = ACCENTS[t.accent]; const G = GLASSES[t.glass];
  const mode: 'dark' | 'light' = t.mode === 'auto' ? (ph.lightish ? 'light' : 'dark') : t.mode; const dark = mode === 'dark';
  const a = (n: number) => Math.min(1, n).toFixed(2); // CSS clamps alpha to 1 anyway; keep the value honest
  const vars: Record<string, string> = dark
    ? { '--tx': '#F6F7FA', '--mu': ph.lightish ? '#F5F7FA' : '#E4E8EF', '--glass': `color-mix(in srgb, ${ph.tint} 28%, rgba(12,14,20,${a(0.64 + (ph.lightish ? 0.12 : 0) + ph.dB / 100 + G.add)}))`, '--bd': 'rgba(255,255,255,0.18)', '--sh': '0 10px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)', '--field': 'rgba(255,255,255,0.09)', '--chipOn': 'rgba(255,255,255,0.18)', '--veil': 'rgba(0,0,0,0.16)', '--base': '#0b0d12' }
    : { '--tx': '#0F1117', '--mu': '#343A49', '--glass': `color-mix(in srgb, ${ph.tint} 16%, rgba(255,255,255,${a(0.6 + ph.lB / 100 + G.add)}))`, '--bd': 'rgba(255,255,255,0.85)', '--sh': '0 10px 40px rgba(20,30,60,0.2), inset 0 1px 0 rgba(255,255,255,0.9)', '--field': 'rgba(15,17,23,0.06)', '--chipOn': 'rgba(15,17,23,0.1)', '--veil': ph.lightish ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.1)', '--base': '#e8ecf2' };
  // Sheen: on opaque dark glass over bright photos the highlight lightens the text background, so it is weaker there (found by `npm run e2e:contrast`).
  vars['--sheen'] = dark && (ph.lightish || t.bd === 'mesh') ? '0.45' : '1';
  vars['--blur'] = G.blur; vars['--rim'] = String(G.rim); vars['--ac'] = A.hex; vars['--acInk'] = dark ? A.hex : A.ink; vars['--bg-image'] = backdropImage(t.bd);
  return { mode, vars };
}
const KEY = 'swift-canvas.theme';
export function loadTheme(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): ThemeChoice { try { const raw = storage?.getItem(KEY); return raw ? sanitize(JSON.parse(raw)) : DEFAULT_THEME; } catch { return DEFAULT_THEME; } }
export function saveTheme(t: ThemeChoice, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): void { try { storage?.setItem(KEY, JSON.stringify(t)); } catch { /* private window or blocked storage: the theme just does not persist */ } }
function safeStorage(): Storage | undefined { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } }
