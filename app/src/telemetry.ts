/** Per-edit telemetry for the Pulse board: one record per edit (tier, skill, model, latency, undone), kept locally (localStorage), never sent anywhere. */
export type Tier = 'local' | 'claude';
export type Rec = { id: number; at: number; tier: Tier; skill: string; model: string; ms: number; ok: boolean; undone: boolean; prompt?: string; rejected?: number; firstMs?: number };
export type SkillStat = { skill: string; tier: Tier; n: number; p50: number; p95: number; failed: number; undone: number };
export const MAX_RECORDS = 500; const KEY = 'swift-canvas.telemetry.v1';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const text = (v: unknown, n: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= n;
/** Untrusted storage -> valid records (bad ones dropped, never the whole list), newest last, capped. */
export function sanitizeRecords(raw: unknown): Rec[] {
  if (!Array.isArray(raw)) return []; const out: Rec[] = [];
  for (const x of raw) { const o = x as Partial<Rec>; if (num(o?.id) && num(o.at) && (o.tier === 'local' || o.tier === 'claude') && text(o.skill, 40) && text(o.model, 40) && num(o.ms) && typeof o.ok === 'boolean' && typeof o.undone === 'boolean') out.push({ id: o.id, at: o.at, tier: o.tier, skill: o.skill, model: o.model, ms: o.ms, ok: o.ok, undone: o.undone, ...(typeof o.prompt === 'string' && o.prompt.length <= 200 ? { prompt: o.prompt } : {}), ...(num(o.rejected) ? { rejected: o.rejected } : {}), ...(num(o.firstMs) ? { firstMs: o.firstMs } : {}) }); }
  return out.slice(-MAX_RECORDS);
}
/** Append one record (id = previous max + 1) and cap the list; returns the new list and the id so a later undo can mark it. */
export function addRecord(list: Rec[], r: Omit<Rec, 'id' | 'undone'>): { list: Rec[]; id: number } {
  const id = list.reduce((m, x) => Math.max(m, x.id), 0) + 1; return { list: [...list, { ...r, id, undone: false }].slice(-MAX_RECORDS), id };
}
export const markUndone = (list: Rec[], id: number, undone = true): Rec[] => list.map((r) => (r.id === id ? { ...r, undone } : r));
/** Nearest-rank percentile of a sorted copy; 0 for an empty list. */
export function percentile(values: number[], p: number): number { if (values.length === 0) return 0; const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]!; }
/** p50/p95 latency per (skill, tier) over the records that succeeded; failures and undos are counted, not timed. Slowest p95 first. */
export function summarize(list: Rec[]): SkillStat[] {
  const g = new Map<string, Rec[]>(); for (const r of list) { const k = `${r.tier}/${r.skill}`; g.set(k, [...(g.get(k) ?? []), r]); }
  return [...g.values()].map((rs) => { const ok = rs.filter((r) => r.ok).map((r) => r.ms); return { skill: rs[0]!.skill, tier: rs[0]!.tier, n: rs.length, p50: percentile(ok, 50), p95: percentile(ok, 95), failed: rs.filter((r) => !r.ok).length, undone: rs.filter((r) => r.undone).length }; }).sort((a, b) => b.p95 - a.p95);
}
type Store = Pick<Storage, 'getItem' | 'setItem'>; const safe = (): Store | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };
export function loadRecords(storage: Pick<Store, 'getItem'> | undefined = safe()): Rec[] { try { const raw = storage?.getItem(KEY); return raw ? sanitizeRecords(JSON.parse(raw)) : []; } catch { return []; } }
export function saveRecords(list: Rec[], storage: Pick<Store, 'setItem'> | undefined = safe()): string | null { try { if (!storage) return 'storage unavailable'; storage.setItem(KEY, JSON.stringify(list)); return null; } catch (e) { return e instanceof Error ? e.message : 'save failed'; } }
/** Skills worth a prompt/skill change: slow (p95 over the tier's budget) or often undone (>= 30% of at least 5 edits). Input for the weekly refiner (#1694). */
export const SLOW_P95_MS: Record<Tier, number> = { local: 50, claude: 8000 };
export function flags(s: SkillStat): ('slow' | 'often undone')[] { const out: ('slow' | 'often undone')[] = []; if (s.n >= 5 && s.p95 > SLOW_P95_MS[s.tier]) out.push('slow'); if (s.n >= 5 && s.undone / s.n >= 0.3) out.push('often undone'); return out; }
