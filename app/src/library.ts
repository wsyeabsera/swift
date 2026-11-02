/** Shared library: elements saved from any project (markup + where they came from), insertable into any frame. Stored in localStorage (one list for all projects). */
import { toBrandTokens } from './brand';
export type LibItem = { id: string; name: string; origin: string; html: string; tokens?: Record<string, string> };
export const MAX_ITEMS = 50; export const MAX_HTML = 20_000; const KEY = 'swift-canvas.library.v1';
const str = (v: unknown, n: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= n;
/** Untrusted storage -> a valid list (bad entries dropped, never the whole list). */
export function sanitizeLibrary(raw: unknown): LibItem[] {
  if (!Array.isArray(raw)) return []; const seen = new Set<string>(); const out: LibItem[] = [];
  for (const x of raw) { const o = x as Partial<LibItem>; if (out.length < MAX_ITEMS && str(o?.id, 60) && str(o.name, 60) && str(o.origin, 60) && str(o.html, MAX_HTML) && !seen.has(o.id)) { seen.add(o.id); const tokens = o.tokens && typeof o.tokens === 'object' ? toBrandTokens(Object.entries(o.tokens).map(([name, value]) => ({ name, value: String(value) }))) : {}; out.push({ id: o.id, name: o.name, origin: o.origin, html: o.html, ...(Object.keys(tokens).length ? { tokens } : {}) }); } }
  return out;
}
/** Add an item: newest first, capped; a too-large element is refused with a reason instead of being truncated into broken markup. */
export function addItem(list: LibItem[], name: string, origin: string, html: string, tokens: Record<string, string> = {}): { ok: true; list: LibItem[] } | { ok: false; error: string } {
  const h = html.trim(); if (!h) return { ok: false, error: 'nothing to save' }; if (h.length > MAX_HTML) return { ok: false, error: `element too large for the library (${h.length} > ${MAX_HTML} chars)` };
  const clean = toBrandTokens(Object.entries(tokens).map(([n, v]) => ({ name: n, value: String(v) }))); // only plain tokens travel with the item
  const base = name.trim().slice(0, 60) || 'element'; let n = 1; let id = `${origin}:${base}`.slice(0, 60); while (list.some((i) => i.id === id)) id = `${origin}:${base}`.slice(0, 55) + `#${++n}`;
  return { ok: true, list: [{ id, name: base, origin, html: h, ...(Object.keys(clean).length ? { tokens: clean } : {}) }, ...list].slice(0, MAX_ITEMS) };
}
/** Rename every id="x" that is already taken in the target frame (or repeated) to x-2, x-3... so an inserted copy never collides. */
export function uniquifyIds(html: string, taken: Set<string>): string {
  const used = new Set(taken); const map = new Map<string, string>();
  return html.replace(/\bid="([^"]+)"/g, (_m, id: string) => { let n = 2; let next = id; while (used.has(next)) next = `${id}-${n++}`; used.add(next); map.set(id, next); return `id="${next}"`; });
}
type Store = Pick<Storage, 'getItem' | 'setItem'>; const safe = (): Store | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };
export function loadLibrary(storage: Pick<Store, 'getItem'> | undefined = safe()): LibItem[] { try { const raw = storage?.getItem(KEY); return raw ? sanitizeLibrary(JSON.parse(raw)) : []; } catch { return []; } }
export function saveLibrary(list: LibItem[], storage: Pick<Store, 'setItem'> | undefined = safe()): string | null { try { if (!storage) return 'storage unavailable'; storage.setItem(KEY, JSON.stringify(list)); return null; } catch (e) { return e instanceof Error ? e.message : 'save failed'; } }
export const removeItem = (list: LibItem[], id: string): LibItem[] => list.filter((i) => i.id !== id);
/** Distinct origin projects, in first-seen order (newest item first), for the filter chips. */
export const origins = (list: LibItem[]): string[] => [...new Set(list.map((i) => i.origin))];
export const filterItems = (list: LibItem[], origin: string | null): LibItem[] => (origin ? list.filter((i) => i.origin === origin) : list);
