/** The Ship log: one line per export (what, where it went, how big, whether it worked), kept per project so the Ship board shows results after a reload. Pure + storage. */
export type ShipRec = { at: number; kind: string; name: string; detail: string; ok: boolean };
export const MAX_SHIP = 30;
export const pushShip = (log: ShipRec[], r: ShipRec): ShipRec[] => [r, ...log].slice(0, MAX_SHIP);
export function sanitizeShip(raw: unknown): ShipRec[] {
  if (!Array.isArray(raw)) return []; return raw.flatMap((x: unknown): ShipRec[] => { const o = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>; return typeof o.at === 'number' && Number.isFinite(o.at) && typeof o.kind === 'string' && typeof o.name === 'string' && typeof o.detail === 'string' && typeof o.ok === 'boolean' ? [{ at: o.at, kind: o.kind.slice(0, 20), name: o.name.slice(0, 80), detail: o.detail.slice(0, 160), ok: o.ok }] : []; }).slice(0, MAX_SHIP);
}
const KEY = (project: string): string => `swift-canvas.ship.v1.${project}`;
export function loadShip(project: string): ShipRec[] { try { const raw = localStorage.getItem(KEY(project)); return raw ? sanitizeShip(JSON.parse(raw)) : []; } catch { return []; } }
export function saveShip(project: string, log: ShipRec[]): void { try { localStorage.setItem(KEY(project), JSON.stringify(log.slice(0, MAX_SHIP))); } catch { /* a convenience: the log is not worth an error */ } }
/** The export targets a queue can run, in the order they run. `needs` names what must exist, so a queue skips with a reason instead of failing. */
export const TARGETS = [{ id: 'artifact', label: 'Artifact page (whole project)' }, { id: 'html', label: 'HTML page (frame)' }, { id: 'react', label: 'React + Tailwind (frame)' }, { id: 'tokens', label: 'Design tokens (DTCG)' }, { id: 'project', label: 'Project file' }, { id: 'glb', label: '3D model (glb)' }, { id: 'mp4', label: 'Motion video (MP4)', needs: 'keyframes' }] as const;
export type TargetId = (typeof TARGETS)[number]['id'];
export const isTarget = (id: string): id is TargetId => TARGETS.some((t) => t.id === id);
