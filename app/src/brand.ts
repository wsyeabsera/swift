import { BRAND_TOKENS } from './say/say';
import { DEFAULT_PROJECT } from './projects';
/** The brand kit Say works with: CSS custom properties found by the import scan. Values go into a prompt and onto a style, so only plain values are accepted. */
const NAME = /^--[a-z0-9][a-z0-9-]{0,39}$/i; const VALUE = /^[^;{}<>\\]{1,60}$/; const MAX = 64; /* the kit a project keeps; Say prompts carry only the first PROMPT_TOKENS */ export const PROMPT_TOKENS = 16; const key = (project: string): string => (project === DEFAULT_PROJECT.id ? 'swift-canvas.brand.v1' : `swift-canvas.brand.v1:${project}`);
export type ScanToken = { name: string; value: string };
export function toBrandTokens(found: ScanToken[]): Record<string, string> {
  const out: Record<string, string> = {}; for (const t of found) { if (Object.keys(out).length >= MAX) break; if (typeof t?.name === 'string' && typeof t?.value === 'string' && NAME.test(t.name) && VALUE.test(t.value.trim()) && !(t.name in out)) out[t.name] = t.value.trim(); } return out;
}
type Store = Pick<Storage, 'getItem' | 'setItem'>; const safe = (): Store | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };
export function loadBrand(storage: Pick<Store, 'getItem'> | undefined = safe(), project = DEFAULT_PROJECT.id): Record<string, string> {
  try { const raw = storage?.getItem(key(project)); const o = raw ? (JSON.parse(raw) as unknown) : null; if (typeof o !== 'object' || o === null) return BRAND_TOKENS; const t = toBrandTokens(Object.entries(o).map(([name, value]) => ({ name, value: String(value) }))); return Object.keys(t).length ? t : BRAND_TOKENS; } catch { return BRAND_TOKENS; }
}
export function saveBrand(tokens: Record<string, string>, storage: Pick<Store, 'setItem'> | undefined = safe(), project = DEFAULT_PROJECT.id): string | null { try { if (!storage) return 'storage unavailable'; storage.setItem(key(project), JSON.stringify(tokens)); return null; } catch (e) { return e instanceof Error ? e.message : 'save failed'; } }
/** Up to `n` colour values of a brand kit, for swatches. */
export const kitColors = (tokens: Record<string, string>, n = 4): string[] => Object.values(tokens).filter((v) => /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\()/i.test(v)).slice(0, n);

const COLOR_LITERAL = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\))$/i;
export const isColorValue = (v: string): boolean => COLOR_LITERAL.test(v.trim());
/** Editing a colour token: every literal equal to its OLD value in a design becomes the NEW value (case-insensitive, whole colour only: #fff never matches inside #ffffff). Non-colour values are not rewritten. */
export function replaceColor(html: string, from: string, to: string): { html: string; count: number } {
  const f = from.trim(); if (!isColorValue(f) || !isColorValue(to) || f.toLowerCase() === to.trim().toLowerCase()) return { html, count: 0 };
  const re = new RegExp(`${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${f.startsWith('#') ? '(?![0-9a-fA-F])' : ''}`, 'gi'); let count = 0;
  return { html: html.replace(re, () => { count++; return to.trim(); }), count };
}

/** Sharing one token with another project is explicit and copies a single token (never the whole kit, never automatic). Respects the kit size cap and the same value rules. */
export function shareToken(target: Record<string, string>, name: string, value: string): { ok: true; kit: Record<string, string> } | { ok: false; error: string } {
  const one = toBrandTokens([{ name, value }]); if (!(name in one)) return { ok: false, error: `${name} cannot be shared: not a plain token` };
  if (!(name in target) && Object.keys(target).length >= MAX) return { ok: false, error: `That kit already has ${MAX} tokens` };
  return { ok: true, kit: { ...target, [name]: one[name]! } };
}
/** Compare two kits by token name: same, different, or only on one side. */
export function compareKits(a: Record<string, string>, b: Record<string, string>): { name: string; a?: string; b?: string; state: 'same' | 'differs' | 'only-a' | 'only-b' }[] {
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return names.map((name) => { const x = a[name], y = b[name]; return { name, ...(x !== undefined ? { a: x } : {}), ...(y !== undefined ? { b: y } : {}), state: x === undefined ? 'only-b' : y === undefined ? 'only-a' : x.trim().toLowerCase() === y.trim().toLowerCase() ? 'same' : 'differs' } as const; });
}
