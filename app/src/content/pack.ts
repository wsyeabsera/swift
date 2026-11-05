import people from './packs/people.json';
import products from './packs/products.json';
import orders from './packs/orders.json';
import metrics from './packs/metrics.json';
import copy from './packs/copy.json';

/** A content pack: named fields that produce realistic values, deterministic by (seed, pack, field, index). */
export type Localized = string[] | Record<string, string[]>;
export type NumberFormat = 'raw' | 'int' | 'decimal' | 'currency' | 'percent';
export type FieldDef =
  | { kind: 'pick'; values: Localized }
  | { kind: 'number'; min: number; max: number; decimals: number; format: NumberFormat }
  | { kind: 'date'; from: string; to: string };
export interface Pack { id: string; description: string; fields: Record<string, FieldDef>; records: Record<string, string[]>; templates: Record<string, string> }
export interface Ctx { seed: string | number; locale?: string; index?: number; currency?: string }

export const PACKS: Record<string, Pack> = Object.fromEntries([people, products, orders, metrics, copy].map((p) => [p.id, p as Pack]));
export const packIds = (): string[] => Object.keys(PACKS);

const DEFAULT_CURRENCY: Record<string, string> = { en: 'USD', de: 'EUR', fr: 'EUR', es: 'EUR', ja: 'JPY', pt: 'EUR' };
const FALLBACK_LOCALE = 'en-US';

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/** mulberry32: tiny seeded generator; same seed gives the same sequence on every machine. */
function rng(seed: number): () => number { let a = seed; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = (c: Ctx, pack: string, field: string, index: number): number => rng(hash(`${c.seed}|${pack}|${field}|${index}`))();

function validLocale(l?: string): string { if (!l) return FALLBACK_LOCALE; try { return Intl.getCanonicalLocales(l)[0] ?? FALLBACK_LOCALE; } catch { return FALLBACK_LOCALE; } }
const lang = (l: string): string => l.split('-')[0] ?? 'en';
function pickList(v: Localized, locale: string): string[] {
  if (Array.isArray(v)) return v;
  return v[locale] ?? v[lang(locale)] ?? v.en ?? Object.values(v)[0] ?? [];
}

export function formatNumber(n: number, f: NumberFormat, decimals: number, c: Ctx): string {
  const locale = validLocale(c.locale);
  switch (f) {
    case 'raw': return String(Math.round(n));
    case 'int': return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
    case 'decimal': return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
    case 'percent': return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: Math.max(0, decimals - 2), maximumFractionDigits: Math.max(0, decimals - 2) }).format(n);
    case 'currency': return new Intl.NumberFormat(locale, { style: 'currency', currency: c.currency ?? DEFAULT_CURRENCY[lang(locale)] ?? 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
  }
}
export const formatDate = (d: Date, c: Ctx): string => new Intl.DateTimeFormat(validLocale(c.locale), { dateStyle: 'medium', timeZone: 'UTC' }).format(d);

function getPack(id: string): Pack { const p = PACKS[id]; if (!p) throw new Error(`unknown content pack "${id}" (have: ${packIds().join(', ')})`); return p; }
function getField(p: Pack, name: string): FieldDef { const f = p.fields[name]; if (!f) throw new Error(`pack "${p.id}" has no field "${name}" (have: ${Object.keys(p.fields).join(', ')})`); return f; }

/** Raw (unformatted) value of one field at an index: string for pick, number for number, Date for date. */
function rawValue(p: Pack, name: string, c: Ctx, index: number): string | number | Date {
  const f = getField(p, name); const r = rand(c, p.id, name, index);
  if (f.kind === 'pick') { const l = pickList(f.values, validLocale(c.locale)); return l[Math.floor(r * l.length)] ?? ''; }
  if (f.kind === 'number') { const v = f.min + r * (f.max - f.min); const m = 10 ** f.decimals; return Math.round(v * m) / m; }
  const a = Date.parse(f.from); const b = Date.parse(f.to); return new Date(Math.round((a + r * (b - a)) / 86400000) * 86400000);
}
function show(p: Pack, name: string, c: Ctx, index: number): string {
  const f = getField(p, name); const v = rawValue(p, name, c, index);
  if (f.kind === 'number') return formatNumber(v as number, f.format, f.decimals, c);
  if (v instanceof Date) return formatDate(v, c);
  return String(v);
}

/** Resolve a slot reference "pack.field" or "pack.template" (e.g. people.name, products.price, orders.label) to display text. Unknown pack or field throws with the valid names. */
export function resolve(ref: string, c: Ctx): string {
  const dot = ref.indexOf('.'); if (dot < 1 || dot === ref.length - 1) throw new Error(`bad content reference "${ref}" (use pack.field)`);
  const p = getPack(ref.slice(0, dot)); const name = ref.slice(dot + 1); const index = c.index ?? 0;
  const t = p.templates[name]; if (t !== undefined) return t.replace(/\{(\w+)\}/g, (_, k: string) => show(p, k, c, index));
  return show(p, name, c, index);
}

/** One row (all fields of a record shape, e.g. "people.person") as display strings; row i is stable and its fields agree with resolve(.., {index: i}). */
export function record(ref: string, c: Ctx): Record<string, string> {
  const dot = ref.indexOf('.'); const p = getPack(ref.slice(0, dot)); const shape = p.records[ref.slice(dot + 1)];
  if (!shape) throw new Error(`pack "${p.id}" has no record "${ref.slice(dot + 1)}" (have: ${Object.keys(p.records).join(', ')})`);
  const index = c.index ?? 0; return Object.fromEntries(shape.map((k) => [k, show(p, k, c, index)]));
}
export const records = (ref: string, n: number, c: Omit<Ctx, 'index'>): Record<string, string>[] => Array.from({ length: n }, (_, i) => record(ref, { ...c, index: i }));

/** A chart series of n numbers within a number field's range: a smooth seeded walk, so lines look real instead of noisy. Raw numbers (format them with formatNumber). */
export function series(ref: string, n: number, c: Omit<Ctx, 'index'>): number[] {
  const dot = ref.indexOf('.'); const p = getPack(ref.slice(0, dot)); const name = ref.slice(dot + 1); const f = getField(p, name);
  if (f.kind !== 'number') throw new Error(`"${ref}" is not a number field`);
  const span = f.max - f.min; const out: number[] = []; let v = 0.35 + 0.3 * rand(c, p.id, name, -1); const drift = 0.01 + 0.02 * rand(c, p.id, name, -2);
  for (let i = 0; i < n; i++) { v = Math.min(0.97, Math.max(0.03, v + drift + (rand(c, p.id, name, i) - 0.5) * 0.14)); const m = 10 ** f.decimals; out.push(Math.round((f.min + v * span) * m) / m); }
  return out;
}

/** Replace {{pack.field}} markers in text; for slots in templates (#1832) that hold a content reference. Unknown refs throw (no silent lorem). */
export const fillText = (text: string, c: Ctx): string => text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, ref: string) => resolve(ref, c));
