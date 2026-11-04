/** Alternates: a few saved looks (outerHTML) of ONE element, cycled in place. Pure. Keyed by `frame/element`; kept in memory for the session (not part of the project file). */
export const MAX_VARIANTS = 8; export const MAX_HTML = 200_000;
export type Alts = Record<string, { variants: string[]; at: number }>;
export const altKey = (frame: string, el: string): string => `${frame}/${el}`;
/** Save the element's current look as a variant. Identical to the current one -> nothing is added. `at` moves to the new variant. */
export function saveVariant(a: Alts, key: string, html: string): { ok: true; alts: Alts } | { ok: false; error: string } {
  if (!html.trim() || html.length > MAX_HTML) return { ok: false, error: 'this element cannot be saved as a variant' }; const cur = a[key]; if (cur && cur.variants[cur.at] === html) return { ok: false, error: 'this look is already saved' };
  const v = [...(cur?.variants ?? []), html]; if (v.length > MAX_VARIANTS) return { ok: false, error: `at most ${MAX_VARIANTS} variants (keep one first)` }; return { ok: true, alts: { ...a, [key]: { variants: v, at: v.length - 1 } } };
}
/** The next variant after the current one, wrapping around; null when there are fewer than two. */
export function cycle(a: Alts, key: string, dir: 1 | -1 = 1): { alts: Alts; html: string; index: number; of: number } | null {
  const c = a[key]; if (!c || c.variants.length < 2) return null; const at = (c.at + dir + c.variants.length) % c.variants.length; return { alts: { ...a, [key]: { ...c, at } }, html: c.variants[at]!, index: at, of: c.variants.length };
}
/** Keep one: drop all the others (the element already shows the one that stays). */
export function keepOne(a: Alts, key: string): Alts { const r = { ...a }; delete r[key]; return r; }
export const count = (a: Alts, key: string): number => a[key]?.variants.length ?? 0;
