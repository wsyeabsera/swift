import { BRAND_TOKENS } from './say/say';
import { DEFAULT_PROJECT } from './projects';
/** The brand kit Say works with: CSS custom properties found by the import scan. Values go into a prompt and onto a style, so only plain values are accepted. */
const NAME = /^--[a-z0-9][a-z0-9-]{0,39}$/i; const VALUE = /^[^;{}<>\\]{1,60}$/; const MAX = 16; const key = (project: string): string => (project === DEFAULT_PROJECT.id ? 'swift-canvas.brand.v1' : `swift-canvas.brand.v1:${project}`);
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
