/** Design Tokens Community Group format (2025.10): export the brand kit as `tokens.json` and import one. Pure. Style Dictionary, Terrazzo and Tokens Studio read it.
 *  Mapping (CSS custom property <-> token): `--ac: #0a84ff` <-> color.ac, `--rad: 28px` <-> dimension.rad, `--font: SF Pro, system-ui` <-> fontFamily.font, `--o: 0.5` <-> number.o.
 *  Values that fit none of these (a blur() function, a two-part margin) are reported as skipped, never guessed. */
import { toBrandTokens } from './brand';
export type Skipped = { name: string; reason: string };
type Json = { [k: string]: unknown };
const GROUP: Record<string, string> = { color: 'color', dimension: 'dimension', fontFamily: 'fontFamily', number: 'number' };
const r6 = (n: number): number => Math.round(n * 1e6) / 1e6;
type Colour = { colorSpace: 'srgb' | 'oklch'; components: number[]; alpha: number; hex?: string };
const hex2 = (n: number): string => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
function parseColour(v: string): Colour | null {
  const s = v.trim().toLowerCase(); let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (m) { let h = m[1]!; if (h.length <= 4) h = [...h].map((c) => c + c).join(''); const n = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1; return { colorSpace: 'srgb', components: n.map((x) => r6(x / 255)), alpha: r6(a), hex: `#${h.slice(0, 6)}` }; }
  m = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+(\d*\.?\d+)(%?))?\s*\)$/.exec(s);
  if (m) { const c = [m[1], m[2], m[3]].map(Number); if (c.some((x) => x > 255)) return null; const a = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1); return { colorSpace: 'srgb', components: c.map((x) => r6(x / 255)), alpha: r6(Math.min(1, a)), hex: `#${c.map(hex2).join('')}` }; }
  m = /^hsla?\(\s*(-?\d*\.?\d+)(?:deg)?[\s,]+(\d*\.?\d+)%[\s,]+(\d*\.?\d+)%(?:[\s,/]+(\d*\.?\d+)(%?))?\s*\)$/.exec(s);
  if (m) { const h = ((Number(m[1]) % 360) + 360) % 360, sat = Number(m[2]) / 100, l = Number(m[3]) / 100; const k = (n: number): number => (n + h / 30) % 12; const a1 = sat * Math.min(l, 1 - l); const f = (n: number): number => l - a1 * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); const c = [f(0), f(8), f(4)]; const al = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1); return { colorSpace: 'srgb', components: c.map(r6), alpha: r6(Math.min(1, al)), hex: `#${c.map((x) => hex2(x * 255)).join('')}` }; }
  m = /^oklch\(\s*(\d*\.?\d+)(%?)\s+(\d*\.?\d+)\s+(-?\d*\.?\d+)(?:deg)?(?:\s*\/\s*(\d*\.?\d+)(%?))?\s*\)$/.exec(s);
  if (m) return { colorSpace: 'oklch', components: [r6(Number(m[1]) / (m[2] ? 100 : 1)), r6(Number(m[3])), r6(Number(m[4]))], alpha: m[5] === undefined ? 1 : r6(Number(m[5]) / (m[6] ? 100 : 1)) };
  return null;
}
function colourToCss(c: Colour): string { if (c.colorSpace === 'oklch') return `oklch(${r6(c.components[0]!)} ${r6(c.components[1]!)} ${r6(c.components[2]!)}${c.alpha < 1 ? ` / ${c.alpha}` : ''})`; const v = c.components.map((x) => Math.round(x * 255)); return c.alpha < 1 ? `rgba(${v.join(', ')}, ${r6(c.alpha)})` : `#${v.map(hex2).join('')}`; }
const fontParts = (v: string): string[] => v.split(',').map((p) => p.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
/** The kit as a DTCG tree plus the properties that had no token type (reported, not exported). */
export function toDtcg(kit: Record<string, string>): { tokens: Json; skipped: Skipped[] } {
  const tokens: Json = {}; const skipped: Skipped[] = []; const put = (type: string, name: string, value: unknown): void => { const g = (tokens[type] ??= { $type: type }) as Json; g[name] = { $value: value }; };
  for (const [prop, raw] of Object.entries(kit)) {
    const name = prop.replace(/^--/, ''); const v = raw.trim(); const c = parseColour(v); if (c) { put('color', name, c); continue; }
    const d = /^(-?\d*\.?\d+)(px|rem)$/.exec(v); if (d) { put('dimension', name, { value: Number(d[1]), unit: d[2] }); continue; }
    if (/^-?\d*\.?\d+$/.test(v)) { put('number', name, Number(v)); continue; }
    if (/^[\w\s"',.-]+$/.test(v) && /[a-z]/i.test(v) && !/^\d/.test(v) && !/\b(?:px|rem|em|vh|vw|s|ms)$/i.test(v)) { const p = fontParts(v); if (p.length) { put('fontFamily', name, p.length === 1 ? p[0] : p); continue; } }
    skipped.push({ name: prop, reason: 'no matching DTCG type' });
  }
  return { tokens, skipped };
}
export const dtcgString = (kit: Record<string, string>): string => JSON.stringify(toDtcg(kit).tokens, null, 2) + '\n';

type Leaf = { path: string[]; type: string | undefined; value: unknown };
const MAX_BYTES = 1_000_000;
function collect(node: Json, path: string[], type: string | undefined, out: Leaf[], depth: number): void {
  if (depth > 8) return; const t = typeof node.$type === 'string' ? node.$type : type;
  if ('$value' in node) { out.push({ path, type: t, value: node.$value }); return; }
  for (const [k, v] of Object.entries(node)) if (!k.startsWith('$') && typeof v === 'object' && v !== null && !Array.isArray(v)) collect(v as Json, [...path, k], t, out, depth + 1);
}
const ref = (v: unknown): string | null => { const m = typeof v === 'string' ? /^\{([^{}]+)\}$/.exec(v.trim()) : null; return m ? m[1]! : null; };
function cssFor(type: string | undefined, v: unknown): string | null {
  if (type === 'color') { if (typeof v === 'string') return parseColour(v) ? v.trim() : null; if (typeof v === 'object' && v !== null) { const o = v as Partial<Colour>; if ((o.colorSpace === 'srgb' || o.colorSpace === 'oklch') && Array.isArray(o.components) && o.components.length === 3 && o.components.every((x) => typeof x === 'number' && Number.isFinite(x))) return colourToCss({ colorSpace: o.colorSpace, components: o.components, alpha: typeof o.alpha === 'number' ? o.alpha : 1 }); } return null; }
  if (type === 'dimension') { if (typeof v === 'string') return /^-?\d*\.?\d+(px|rem)$/.test(v.trim()) ? v.trim() : null; if (typeof v === 'object' && v !== null) { const o = v as { value?: unknown; unit?: unknown }; return typeof o.value === 'number' && Number.isFinite(o.value) && (o.unit === 'px' || o.unit === 'rem') ? `${r6(o.value)}${o.unit}` : null; } return null; }
  if (type === 'number') return typeof v === 'number' && Number.isFinite(v) ? String(r6(v)) : null;
  if (type === 'fontFamily') { const a = typeof v === 'string' ? [v] : Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null; return a && a.length ? a.map((x) => (/[\s]/.test(x) && !/^["']/.test(x) ? x : x)).join(', ') : null; }
  return null;
}
/** A DTCG file -> brand kit tokens: colours first (at most 16), then the rest up to the kit size; aliases ({color.ac}) are resolved, anything unusable is listed in `skipped` with its reason. */
export function fromDtcg(text: string): { ok: true; tokens: Record<string, string>; skipped: Skipped[] } | { ok: false; error: string } {
  if (text.length > MAX_BYTES) return { ok: false, error: 'file too large' }; let raw: unknown; try { raw = JSON.parse(text); } catch { return { ok: false, error: 'not JSON' }; }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'not a DTCG token file (expected an object of token groups)' };
  const leaves: Leaf[] = []; collect(raw as Json, [], undefined, leaves, 0); if (!leaves.length) return { ok: false, error: 'no tokens found (a token has a "$value")' };
  const byPath = new Map(leaves.map((l) => [l.path.join('.'), l])); const skipped: Skipped[] = [];
  const resolve = (l: Leaf, seen: string[] = []): { type: string | undefined; value: unknown } | null => { const r = ref(l.value); if (r === null) return { type: l.type, value: l.value }; if (seen.length > 10 || seen.includes(r)) return null; const t = byPath.get(r); return t ? resolve({ ...t, type: l.type ?? t.type }, [...seen, r]) : null; };
  type Item = { name: string; css: string; colour: boolean }; const items: Item[] = []; const used = new Set<string>();
  for (const l of leaves) {
    const label = l.path.join('.'); const res = resolve(l); if (!res) { skipped.push({ name: label, reason: ref(l.value) !== null ? 'alias does not resolve' : 'unreadable' }); continue; }
    const css = cssFor(res.type, res.value); if (css === null) { skipped.push({ name: label, reason: `unsupported ${res.type ?? 'untyped'} value` }); continue; }
    const rest = l.path.length > 1 && l.path[0]! in GROUP ? l.path.slice(1) : l.path; let name = rest.join('-').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 38); if (!name) { skipped.push({ name: label, reason: 'no usable name' }); continue; }
    let n = name, i = 2; while (used.has(n)) n = `${name.slice(0, 35)}-${i++}`; used.add(n); items.push({ name: `--${n}`, css, colour: res.type === 'color' });
  }
  const colours = items.filter((x) => x.colour).slice(0, 16); const rest = items.filter((x) => !x.colour); const picked = [...colours, ...rest]; const tokens = toBrandTokens(picked.map((x) => ({ name: x.name, value: x.css })));
  for (const x of picked) if (!(x.name in tokens)) skipped.push({ name: x.name, reason: 'not a plain value Say can use' }); for (const x of items.filter((y) => y.colour).slice(16)) skipped.push({ name: x.name, reason: 'only the first 16 colours are imported' });
  if (!Object.keys(tokens).length) return { ok: false, error: 'no usable tokens (colours, px/rem sizes, font families and numbers are read)' };
  return { ok: true, tokens, skipped };
}
