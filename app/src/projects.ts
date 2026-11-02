/** Projects: a name plus its own saved design and brand (keys in doc.ts / brand.ts are per project id). The registry lives in localStorage; switching reloads the page. */
export type Project = { id: string; name: string };
export const DEFAULT_PROJECT: Project = { id: 'tvdash', name: 'tvdash' };
const KEY = 'swift-canvas.projects.v1'; const MAX = 50;
export type Registry = { active: string; list: Project[] };
type Store = Pick<Storage, 'getItem' | 'setItem'>; const safe = (): Store | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };
const DEFAULT_REG = (): Registry => ({ active: DEFAULT_PROJECT.id, list: [DEFAULT_PROJECT] });
export const slug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
/** Untrusted input (storage) -> a valid registry that always contains the active project. */
export function sanitizeRegistry(raw: unknown): Registry {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as { active?: unknown; list?: unknown }; const seen = new Set<string>(); const list: Project[] = [];
  if (Array.isArray(o.list)) for (const p of o.list) { const q = p as Partial<Project>; if (typeof q?.id === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(q.id) && typeof q.name === 'string' && q.name.trim() && !seen.has(q.id) && list.length < MAX) { seen.add(q.id); list.push({ id: q.id, name: q.name.trim().slice(0, 60) }); } }
  if (!seen.has(DEFAULT_PROJECT.id)) list.unshift(DEFAULT_PROJECT);
  return { active: typeof o.active === 'string' && list.some((p) => p.id === o.active) ? o.active : DEFAULT_PROJECT.id, list };
}
export function loadRegistry(storage: Pick<Store, 'getItem'> | undefined = safe()): Registry { try { const raw = storage?.getItem(KEY); return raw ? sanitizeRegistry(JSON.parse(raw)) : DEFAULT_REG(); } catch { return DEFAULT_REG(); } }
export function saveRegistry(r: Registry, storage: Pick<Store, 'setItem'> | undefined = safe()): string | null { try { if (!storage) return 'storage unavailable'; storage.setItem(KEY, JSON.stringify(r)); return null; } catch (e) { return e instanceof Error ? e.message : 'save failed'; } }
export const activeProject = (r: Registry): Project => r.list.find((p) => p.id === r.active) ?? DEFAULT_PROJECT;
/** Add a project (or reuse one with the same slug) and make it active. Returns null when the name has no usable characters. */
export function addProject(r: Registry, name: string): Registry | null {
  const clean = name.trim().slice(0, 60); const id = slug(clean); if (!id) return null; const hit = r.list.find((p) => p.id === id);
  if (hit) return { ...r, active: hit.id }; if (r.list.length >= MAX) return null; return { active: id, list: [...r.list, { id, name: clean }] };
}
export const switchProject = (r: Registry, id: string): Registry => (r.list.some((p) => p.id === id) ? { ...r, active: id } : r);
export const baseName = (path: string): string => path.replace(/\/+$/, '').split('/').pop() ?? '';
