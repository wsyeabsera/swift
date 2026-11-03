import type { FrameDef } from './canvas/fixtures';
import type { Branch, Log, Op, Placed } from './oplog';

/** The saved design: frame layout plus each frame's current HTML. Stored per browser profile (localStorage); the project file in the repo comes later (#1673). */
import { DEFAULT_PROJECT } from './projects';
/** The default project keeps the original key (designs saved before projects existed still load). */
const key = (project: string): string => (project === DEFAULT_PROJECT.id ? 'swift-canvas.doc.v1' : `swift-canvas.doc.v1:${project}`);
const MAX_FRAMES = 200;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Untrusted input (storage) -> frames, or null if anything is off (an all-or-nothing restore never mixes good and bad frames). */
export function parseDoc(raw: unknown): FrameDef[] | null {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as { frames?: unknown }).frames)) return null;
  const list = (raw as { frames: unknown[] }).frames; if (list.length === 0 || list.length > MAX_FRAMES) return null;
  const out: FrameDef[] = []; const ids = new Set<string>();
  for (const f of list) { const fd = parseFrame(f); if (!fd || ids.has(fd.id)) return null; ids.add(fd.id); out.push(fd); }
  return out;
}
/** One frame from untrusted input, or null. */
export function parseFrame(f: unknown): FrameDef | null {
  const o = f as Record<string, unknown>;
  if (typeof f !== 'object' || f === null || !str(o.id) || !str(o.root) || !str(o.title) || !str(o.html) || !num(o.x) || !num(o.y) || !num(o.w) || !num(o.h) || o.w <= 0 || o.h <= 0) return null;
  return { id: o.id, root: o.root, title: o.title, x: o.x, y: o.y, w: o.w, h: o.h, html: o.html, ...(o.kept === true ? { kept: true } : {}) };
}

// ---- the op log saved next to the frames (one JSON object = one atomic write, so log and frames never disagree about what was saved) ----
export const MAX_LOG_OPS = 2000; export const MAX_LOG_CHARS = 1_500_000; // localStorage is ~5 MB per origin and holds the frames too
const text = (v: unknown): v is string => typeof v === 'string';
const idx = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const placed = (v: unknown): Placed[] | null => { if (!Array.isArray(v)) return null; const out: Placed[] = []; for (const x of v) { const o = x as { def?: unknown; index?: unknown }; const def = parseFrame(o?.def); if (!def || !idx(o.index)) return null; out.push({ def, index: o.index }); } return out; };
/** One op from untrusted input, or null (groups may nest 3 deep). */
export function parseOp(raw: unknown, depth = 0): Op | null {
  if (typeof raw !== 'object' || raw === null || depth > 3) return null; const o = raw as Record<string, unknown>; const rec = o.rec === undefined ? {} : idx(o.rec) ? { rec: o.rec } : null; if (!rec) return null;
  switch (o.kind) {
    case 'set': return text(o.frame) && text(o.el) && text(o.prop) && text(o.before) && text(o.after) ? { kind: 'set', frame: o.frame, el: o.el, prop: o.prop, before: o.before, after: o.after, ...rec } : null;
    case 'text': return text(o.frame) && text(o.el) && text(o.before) && text(o.after) ? { kind: 'text', frame: o.frame, el: o.el, before: o.before, after: o.after, ...rec } : null;
    case 'add': case 'remove': return text(o.frame) && text(o.parent) && text(o.html) ? { kind: o.kind, frame: o.frame, parent: o.parent, html: o.html, ...rec } : null;
    case 'snap': return text(o.frame) && text(o.before) && text(o.after) ? { kind: 'snap', frame: o.frame, before: o.before, after: o.after, ...rec } : null;
    case 'frameDel': case 'frameAdd': { const def = parseFrame(o.def); return text(o.frame) && def && idx(o.index) ? { kind: o.kind, frame: o.frame, def, index: o.index, ...rec } : null; }
    case 'discard': case 'restore': { const items = placed(o.items); return text(o.frame) && items ? { kind: o.kind, frame: o.frame, items, ...rec } : null; }
    case 'brand': return typeof o.name === 'string' && /^--[a-z0-9][a-z0-9-]{0,39}$/i.test(o.name) && typeof o.before === 'string' && typeof o.after === 'string' && o.before.length <= 80 && o.after.length <= 80 ? { kind: 'brand', name: o.name, before: o.before, after: o.after, ...rec } : null;
    case 'rename': return text(o.frame) && text(o.before) && text(o.after) ? { kind: 'rename', frame: o.frame, before: o.before, after: o.after, ...rec } : null;
    case 'group': { if (!text(o.label) || !Array.isArray(o.ops)) return null; const ops: Op[] = []; for (const c of o.ops) { const op = parseOp(c, depth + 1); if (!op) return null; ops.push(op); } return { kind: 'group', label: o.label, ops, ...rec }; }
    default: return null;
  }
}
/** A saved log, or null when anything is off (all-or-nothing, like the frames: a bad log becomes an empty one, never a half-restored undo history). */
export function parseLog(raw: unknown): Log | null {
  if (typeof raw !== 'object' || raw === null) return null; const r = raw as { branches?: unknown; current?: unknown; head?: unknown };
  if (typeof r.branches !== 'object' || r.branches === null || Array.isArray(r.branches) || !text(r.current) || !idx(r.head)) return null;
  const names = Object.keys(r.branches); if (!names.includes('main') || !names.includes(r.current)) return null; const branches: Record<string, Branch> = {}; let total = 0;
  for (const n of names) {
    const b = (r.branches as Record<string, { parent?: unknown; at?: unknown; ops?: unknown }>)[n]; if (!b || !Array.isArray(b.ops) || !idx(b.at) || !(b.parent === null || text(b.parent))) return null;
    if ((n === 'main') !== (b.parent === null) || (b.parent !== null && !names.includes(b.parent as string))) return null; total += b.ops.length; if (total > MAX_LOG_OPS) return null;
    const ops: Op[] = []; for (const c of b.ops) { const op = parseOp(c); if (!op) return null; ops.push(op); } branches[n] = { parent: b.parent as string | null, at: b.at, ops };
  }
  for (const n of names) { let p = branches[n]!.parent; let hops = 0; while (p !== null) { if (++hops > names.length) return null; p = branches[p]!.parent; } if (branches[n]!.parent !== null && branches[n]!.at > branches[branches[n]!.parent!]!.ops.length) return null; }
  if (r.head > branches[r.current]!.ops.length) return null; return { branches, current: r.current, head: r.head };
}
/** Keep the saved log inside the budget by dropping the OLDEST steps of the only branch (undo reaches back less far; nothing newer is lost). Multi-branch logs are saved whole for now. */
export function fitLog(log: Log): Log {
  const names = Object.keys(log.branches); if (names.length !== 1) return log; const b = log.branches[log.current]!; let drop = Math.max(0, b.ops.length - MAX_LOG_OPS); const size = (ops: Op[]) => JSON.stringify(ops).length;
  let ops = b.ops.slice(drop); while (ops.length > 0 && size(ops) > MAX_LOG_CHARS) { ops = ops.slice(1); drop++; }
  return drop === 0 ? log : { ...log, head: Math.max(0, log.head - drop), branches: { [log.current]: { ...b, ops } } };
}
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const safe = (): Store | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };
export function loadLog(storage: Pick<Store, 'getItem'> | undefined = safe(), project = DEFAULT_PROJECT.id): Log | null { try { const raw = storage?.getItem(key(project)); return raw ? parseLog((JSON.parse(raw) as { log?: unknown }).log) : null; } catch { return null; } }
export function loadDoc(storage: Pick<Store, 'getItem'> | undefined = safe(), project = DEFAULT_PROJECT.id): FrameDef[] | null { try { const raw = storage?.getItem(key(project)); return raw ? parseDoc(JSON.parse(raw)) : null; } catch { return null; } }
/** Returns an error message when the design could not be saved (quota, blocked storage): the caller shows it, it is never swallowed. */
export function saveDoc(frames: FrameDef[], storage: Pick<Store, 'setItem'> | undefined = safe(), project = DEFAULT_PROJECT.id, log?: Log): string | null {
  if (!storage) return 'storage unavailable';
  try { storage.setItem(key(project), JSON.stringify(log ? { frames, log: fitLog(log) } : { frames })); return null; } catch (e) { return e instanceof Error ? e.message : 'save failed'; }
}
export function clearDoc(storage: Pick<Store, 'removeItem'> | undefined = safe(), project = DEFAULT_PROJECT.id): void { try { storage?.removeItem(key(project)); } catch { /* nothing saved that we could remove */ } }
/** Spark ids are `<base>-t<n>`: continue after the highest n so a restored design never collides with a new take. */
export function nextSparkN(frames: FrameDef[]): number { return frames.reduce((m, f) => { const k = /-t(\d+)$/.exec(f.id); return k ? Math.max(m, Number(k[1])) : m; }, 0); }
