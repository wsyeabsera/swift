/** Motion timeline: properties of elements over time. Pure data and maths, no DOM. An ease belongs to the segment that STARTS at its key.
 *  Values are CSS strings: numbers with a unit ("12px", "0.5") and colours (#rgb, #rrggbb, rgb()/rgba()) interpolate; anything else holds until its segment ends. */
export const EASES = ['linear', 'quad.in', 'quad.out', 'quad.inOut', 'cubic.in', 'cubic.out', 'cubic.inOut', 'expo.in', 'expo.out', 'expo.inOut', 'back.out'] as const;
export type Ease = (typeof EASES)[number];
export type Key = { t: number; v: string; ease: Ease }; // t in ms
export type Track = { frame: string; el: string; prop: string; keys: Key[] }; // keys sorted by t, unique t
export type Timeline = { duration: number; tracks: Track[] };
export const MAX_DURATION = 60_000; export const MAX_TRACKS = 200; export const MAX_KEYS = 100;
export const emptyTimeline = (duration = 2000): Timeline => ({ duration, tracks: [] });
const inOut = (f: (p: number) => number) => (p: number): number => (p < 0.5 ? f(p * 2) / 2 : 1 - f((1 - p) * 2) / 2);
const EASE_FN: Record<Ease, (p: number) => number> = {
  linear: (p) => p, 'quad.in': (p) => p * p, 'quad.out': (p) => 1 - (1 - p) * (1 - p), 'quad.inOut': inOut((p) => p * p),
  'cubic.in': (p) => p ** 3, 'cubic.out': (p) => 1 - (1 - p) ** 3, 'cubic.inOut': inOut((p) => p ** 3),
  'expo.in': (p) => (p === 0 ? 0 : 2 ** (10 * p - 10)), 'expo.out': (p) => (p === 1 ? 1 : 1 - 2 ** (-10 * p)), 'expo.inOut': inOut((p) => (p === 0 ? 0 : 2 ** (10 * p - 10))),
  'back.out': (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2,
};
export const ease = (name: Ease, p: number): number => EASE_FN[name](Math.min(1, Math.max(0, p)));
export const isEase = (x: unknown): x is Ease => typeof x === 'string' && (EASES as readonly string[]).includes(x);

type Num = { n: number; unit: string }; type Rgba = [number, number, number, number];
const NUM = /^(-?\d*\.?\d+)([a-z%]*)$/i;
const num = (v: string): Num | null => { const m = NUM.exec(v.trim()); return m ? { n: Number(m[1]), unit: m[2]!.toLowerCase() } : null; };
function colour(v: string): Rgba | null {
  const s = v.trim().toLowerCase(); let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (m) { const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]; }
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+(\d*\.?\d+))?\s*\)$/.exec(s); return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null;
}
const round = (x: number): number => Math.round(x * 1000) / 1000;
/** Between two values at progress p (already eased). Same-unit numbers and colours blend; otherwise the first value holds until p reaches 1. */
export function mix(a: string, b: string, p: number): string {
  const ta = tokens(a), tb = tokens(b); if (ta.length > 1 && ta.length === tb.length) { const parts = ta.map((t, i) => mixOne(t, tb[i]!, p)); if (parts.every((x) => x !== null)) return parts.join(' '); } // "400px 0px" (translate, scale, padding...): each part on its own
  return mixOne(a, b, p) ?? (p >= 1 ? b : a);
}
/** Whitespace-separated parts, not splitting inside parentheses ("rgb(1, 2, 3) 4px" is two). */
function tokens(v: string): string[] { const out: string[] = []; let cur = '', d = 0; for (const ch of v.trim()) { if (ch === '(') d++; else if (ch === ')') d--; if (/\s/.test(ch) && d === 0) { if (cur) out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; }
function mixOne(a: string, b: string, p: number): string | null {
  const x = num(a), y = num(b); if (x && y && (x.unit === y.unit)) return `${round(x.n + (y.n - x.n) * p)}${x.unit}`;
  const c = colour(a), d = colour(b); if (c && d) { const k = c.map((v, i) => v + (d[i]! - v) * p) as Rgba; return `rgba(${Math.round(k[0])}, ${Math.round(k[1])}, ${Math.round(k[2])}, ${round(k[3])})`; }
  return null;
}
/** The value of a track at time t (ms): before the first key it is the first value, after the last key the last. */
export function valueAt(tr: Track, t: number): string | null {
  const k = tr.keys; if (!k.length) return null; if (t <= k[0]!.t) return k[0]!.v; const end = k[k.length - 1]!; if (t >= end.t) return end.v;
  let i = 0; while (k[i + 1]!.t <= t) i++; const a = k[i]!, b = k[i + 1]!; return mix(a.v, b.v, ease(a.ease, (t - a.t) / (b.t - a.t)));
}
export type Sample = { frame: string; el: string; prop: string; value: string };
/** Every track's value at t, for one frame (or all frames when none is named). */
export function sample(tl: Timeline, t: number, frame?: string): Sample[] {
  const out: Sample[] = []; for (const tr of tl.tracks) { if (frame !== undefined && tr.frame !== frame) continue; const value = valueAt(tr, t); if (value !== null) out.push({ frame: tr.frame, el: tr.el, prop: tr.prop, value }); } return out;
}
const same = (a: Track, f: string, e: string, p: string): boolean => a.frame === f && a.el === e && a.prop === p;
/** Add or replace a keyframe (a key within 1 ms of an existing one replaces it). Limits are enforced, never truncated: the old timeline comes back with an error. */
export function setKey(tl: Timeline, frame: string, el: string, prop: string, t: number, v: string, e: Ease = 'linear'): { ok: true; tl: Timeline } | { ok: false; error: string } {
  if (!Number.isFinite(t)) return { ok: false, error: 'time must be a number' }; if (!v.trim() || v.length > 200) return { ok: false, error: 'value must be 1-200 characters' }; const at = Math.round(Math.min(tl.duration, Math.max(0, t)));
  const old = tl.tracks.find((x) => same(x, frame, el, prop)); if (!old && tl.tracks.length >= MAX_TRACKS) return { ok: false, error: `at most ${MAX_TRACKS} animated properties` };
  const keys = (old?.keys ?? []).filter((k) => Math.abs(k.t - at) > 1); if (keys.length >= MAX_KEYS) return { ok: false, error: `at most ${MAX_KEYS} keyframes per property` };
  const next: Track = { frame, el, prop, keys: [...keys, { t: at, v, ease: e }].sort((a, b) => a.t - b.t) };
  return { ok: true, tl: { ...tl, tracks: old ? tl.tracks.map((x) => (x === old ? next : x)) : [...tl.tracks, next] } };
}
/** Set the ease of the segment starting at the key nearest `t` (within 1 ms), on every track of the element when `prop` is omitted ("make it ease out"). */
export function setEase(tl: Timeline, frame: string, el: string, e: Ease, prop?: string, t?: number): Timeline {
  return { ...tl, tracks: tl.tracks.map((x) => (x.frame === frame && x.el === el && (prop === undefined || x.prop === prop) ? { ...x, keys: x.keys.map((k, i) => (t === undefined ? i < x.keys.length - 1 : Math.abs(k.t - t) <= 1) ? { ...k, ease: e } : k) } : x)) };
}
export function removeKey(tl: Timeline, frame: string, el: string, prop: string, t: number): Timeline {
  return { ...tl, tracks: tl.tracks.map((x) => (same(x, frame, el, prop) ? { ...x, keys: x.keys.filter((k) => Math.abs(k.t - t) > 1) } : x)).filter((x) => x.keys.length > 0) };
}
/** Untrusted JSON -> a valid timeline (bad tracks and keys dropped, never the whole thing); null when it is not a timeline at all. */
export function parseTimeline(raw: unknown): Timeline | null {
  if (typeof raw !== 'object' || raw === null) return null; const o = raw as Record<string, unknown>; const duration = typeof o.duration === 'number' && o.duration > 0 && o.duration <= MAX_DURATION ? o.duration : null; if (duration === null || !Array.isArray(o.tracks)) return null;
  const tracks: Track[] = []; const seen = new Set<string>();
  for (const x of o.tracks) {
    if (tracks.length >= MAX_TRACKS || typeof x !== 'object' || x === null) continue; const r = x as Record<string, unknown>; if (typeof r.frame !== 'string' || typeof r.el !== 'string' || typeof r.prop !== 'string' || !Array.isArray(r.keys)) continue;
    const id = `${r.frame}/${r.el}/${r.prop}`; if (seen.has(id) || id.length > 300) continue;
    const ts = new Set<number>(); const keys = r.keys.flatMap((k): Key[] => { if (typeof k !== 'object' || k === null) return []; const q = k as Record<string, unknown>; if (typeof q.t !== 'number' || !Number.isFinite(q.t) || q.t < 0 || q.t > duration || typeof q.v !== 'string' || !q.v.trim() || q.v.length > 200 || !isEase(q.ease) || ts.has(q.t)) return []; ts.add(q.t); return [{ t: q.t, v: q.v, ease: q.ease }]; }).sort((a, b) => a.t - b.t).slice(0, MAX_KEYS);
    if (keys.length) { seen.add(id); tracks.push({ frame: r.frame, el: r.el, prop: r.prop, keys }); }
  }
  return { duration, tracks };
}
type Store = Pick<Storage, 'getItem' | 'setItem'>; const safe = (): Store | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };
const KEY = (project: string): string => `swift-canvas.motion.v1.${project}`;
export function loadTimeline(project: string, storage: Pick<Store, 'getItem'> | undefined = safe()): Timeline { try { const raw = storage?.getItem(KEY(project)); return (raw ? parseTimeline(JSON.parse(raw)) : null) ?? emptyTimeline(); } catch { return emptyTimeline(); } }
export function saveTimeline(project: string, tl: Timeline, storage: Pick<Store, 'setItem'> | undefined = safe()): string | null { try { if (!storage) return 'storage unavailable'; storage.setItem(KEY(project), JSON.stringify(tl)); return null; } catch (e) { return e instanceof Error ? e.message : 'save failed'; } }
