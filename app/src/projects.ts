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
/** A name whose slug is not taken yet: "X", then "X 2", "X 3"... (importing a file must never overwrite an existing project). */
export function uniqueName(list: Project[], name: string): string {
  const base = name.trim().slice(0, 56); const used = new Set(list.map((p) => p.id)); if (!used.has(slug(base))) return base; let n = 2; while (used.has(slug(`${base} ${n}`))) n++; return `${base} ${n}`;
}

/** Quick switcher ranking: the projects that match `query` (name or id), best first: exact start, then a word start, then anywhere, then letters in order; ties and the empty query go by how recently each was opened (`recent`: ids, newest first), then by name. Pure. */
export function rankProjects(list: Project[], query: string, recent: string[]): Project[] {
  const q = query.trim().toLowerCase(); const rec = (id: string): number => { const i = recent.indexOf(id); return i < 0 ? 1e6 : i; };
  const score = (p: Project): number => {
    if (!q) return 0; const n = p.name.toLowerCase(); if (n.startsWith(q)) return 1; if (n.split(/[^a-z0-9]+/).some((w) => w.startsWith(q))) return 2; if (n.includes(q) || p.id.includes(q)) return 3;
    let i = 0; for (const ch of n) if (ch === q[i]) i++; return i === q.length ? 4 : 99;
  };
  return list.map((p) => ({ p, s: score(p) })).filter((x) => x.s < 99).sort((a, b) => a.s - b.s || rec(a.p.id) - rec(b.p.id) || a.p.name.localeCompare(b.p.name)).map((x) => x.p);
}
const RECENT_KEY = 'swift-canvas.recent-projects.v1';
export const touchRecent = (recent: string[], id: string): string[] => [id, ...recent.filter((x) => x !== id)].slice(0, 20);
export function loadRecent(storage: Pick<Store, 'getItem'> | undefined = safe()): string[] { try { const raw = storage?.getItem(RECENT_KEY); const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string').slice(0, 20) : []; } catch { return []; } }
export function saveRecent(recent: string[], storage: Pick<Store, 'setItem'> | undefined = safe()): void { try { storage?.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 20))); } catch { /* a convenience: not worth an error */ } }
