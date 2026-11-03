/** Token usage per request, for a local usage meter. Kept in localStorage like telemetry.ts, never sent anywhere. */
export type Usage = { input: number; output: number };
export type UsageRec = Usage & { at: number };
export type UsageSummary = { requests: number; input: number; output: number; avgInput: number; avgOutput: number };
export const MAX_USAGE = 500; const KEY = 'swift-canvas.usage.v1';
/** ESTIMATE only (chars / 4, a rough English/code average), for before-the-fact meters; real counts come from Claude's result.usage. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);
export const addUsage = (total: Usage, u: Usage): Usage => ({ input: total.input + u.input, output: total.output + u.output });
export function summarizeUsage(list: Usage[]): UsageSummary {
  const t = list.reduce(addUsage, { input: 0, output: 0 }); const n = list.length;
  return { requests: n, input: t.input, output: t.output, avgInput: n ? Math.round(t.input / n) : 0, avgOutput: n ? Math.round(t.output / n) : 0 };
}
export const appendUsage = (list: UsageRec[], r: UsageRec): UsageRec[] => [...list, r].slice(-MAX_USAGE);
const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export function sanitizeUsage(raw: unknown): UsageRec[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is UsageRec => !!r && typeof r === 'object' && ok((r as UsageRec).input) && ok((r as UsageRec).output) && ok((r as UsageRec).at)).slice(-MAX_USAGE);
}
type Store = Pick<Storage, 'getItem' | 'setItem'>; const safe = (): Store | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };
export function loadUsage(storage: Pick<Store, 'getItem'> | undefined = safe()): UsageRec[] { try { const raw = storage?.getItem(KEY); return raw ? sanitizeUsage(JSON.parse(raw)) : []; } catch { return []; } }
export function saveUsage(list: UsageRec[], storage: Pick<Store, 'setItem'> | undefined = safe()): string | null { try { if (!storage) return 'storage unavailable'; storage.setItem(KEY, JSON.stringify(list.slice(-MAX_USAGE))); return null; } catch (e) { return e instanceof Error ? e.message : 'save failed'; } }
/** Estimated tokens for a Spark of `n` takes: n x the average of recent requests (needs 3+ samples), else the measured defaults (~4.1k in / ~150 out per request, #1740). Includes cached input, like the helper's `usage`. */
export const DEFAULT_REQUEST: Usage = { input: 4100, output: 150 };
export function estimateSpark(list: Usage[], n: number): Usage {
  const s = summarizeUsage(list); const per = s.requests >= 3 ? { input: s.avgInput, output: s.avgOutput } : DEFAULT_REQUEST;
  return { input: Math.round(per.input * n), output: Math.round(per.output * n) };
}
/** Compact token count: 950 -> "950", 17250 -> "17k", 1_250_000 -> "1.3M". */
export const tokensShort = (n: number): string => (n < 1000 ? String(Math.round(n)) : n < 1_000_000 ? `${Math.round(n / 1000)}k` : `${(n / 1_000_000).toFixed(1)}M`);
