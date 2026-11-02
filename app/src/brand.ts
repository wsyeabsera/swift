import { BRAND_TOKENS } from './say/say';
/** The brand kit Say works with: CSS custom properties found by the import scan. Values go into a prompt and onto a style, so only plain values are accepted. */
const NAME = /^--[a-z0-9][a-z0-9-]{0,39}$/i; const VALUE = /^[^;{}<>\\]{1,60}$/; const MAX = 16; const KEY = 'swift-canvas.brand.v1';
export type ScanToken = { name: string; value: string };
export function toBrandTokens(found: ScanToken[]): Record<string, string> {
  const out: Record<string, string> = {}; for (const t of found) { if (Object.keys(out).length >= MAX) break; if (typeof t?.name === 'string' && typeof t?.value === 'string' && NAME.test(t.name) && VALUE.test(t.value.trim()) && !(t.name in out)) out[t.name] = t.value.trim(); } return out;
}
type Store = Pick<Storage, 'getItem' | 'setItem'>; const safe = (): Store | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };
export function loadBrand(storage: Pick<Store, 'getItem'> | undefined = safe()): Record<string, string> {
  try { const raw = storage?.getItem(KEY); const o = raw ? (JSON.parse(raw) as unknown) : null; if (typeof o !== 'object' || o === null) return BRAND_TOKENS; const t = toBrandTokens(Object.entries(o).map(([name, value]) => ({ name, value: String(value) }))); return Object.keys(t).length ? t : BRAND_TOKENS; } catch { return BRAND_TOKENS; }
}
export function saveBrand(tokens: Record<string, string>, storage: Pick<Store, 'setItem'> | undefined = safe()): string | null { try { if (!storage) return 'storage unavailable'; storage.setItem(KEY, JSON.stringify(tokens)); return null; } catch (e) { return e instanceof Error ? e.message : 'save failed'; } }
