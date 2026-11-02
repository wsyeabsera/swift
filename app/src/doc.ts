import type { FrameDef } from './canvas/fixtures';

/** The saved design: frame layout plus each frame's current HTML. Stored per browser profile (localStorage); the project file in the repo comes later (#1673). */
const KEY = 'swift-canvas.doc.v1';
const MAX_FRAMES = 200;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Untrusted input (storage) -> frames, or null if anything is off (an all-or-nothing restore never mixes good and bad frames). */
export function parseDoc(raw: unknown): FrameDef[] | null {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as { frames?: unknown }).frames)) return null;
  const list = (raw as { frames: unknown[] }).frames; if (list.length === 0 || list.length > MAX_FRAMES) return null;
  const out: FrameDef[] = []; const ids = new Set<string>();
  for (const f of list) {
    const o = f as Record<string, unknown>;
    if (typeof f !== 'object' || f === null || !str(o.id) || !str(o.root) || !str(o.title) || !str(o.html) || !num(o.x) || !num(o.y) || !num(o.w) || !num(o.h) || o.w <= 0 || o.h <= 0 || ids.has(o.id)) return null;
    ids.add(o.id); out.push({ id: o.id, root: o.root, title: o.title, x: o.x, y: o.y, w: o.w, h: o.h, html: o.html, ...(o.kept === true ? { kept: true } : {}) });
  }
  return out;
}
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const safe = (): Store | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };
export function loadDoc(storage: Pick<Store, 'getItem'> | undefined = safe()): FrameDef[] | null { try { const raw = storage?.getItem(KEY); return raw ? parseDoc(JSON.parse(raw)) : null; } catch { return null; } }
/** Returns an error message when the design could not be saved (quota, blocked storage): the caller shows it, it is never swallowed. */
export function saveDoc(frames: FrameDef[], storage: Pick<Store, 'setItem'> | undefined = safe()): string | null {
  if (!storage) return 'storage unavailable';
  try { storage.setItem(KEY, JSON.stringify({ frames })); return null; } catch (e) { return e instanceof Error ? e.message : 'save failed'; }
}
export function clearDoc(storage: Pick<Store, 'removeItem'> | undefined = safe()): void { try { storage?.removeItem(KEY); } catch { /* nothing saved that we could remove */ } }
/** Spark ids are `<base>-t<n>`: continue after the highest n so a restored design never collides with a new take. */
export function nextSparkN(frames: FrameDef[]): number { return frames.reduce((m, f) => { const k = /-t(\d+)$/.exec(f.id); return k ? Math.max(m, Number(k[1])) : m; }, 0); }
