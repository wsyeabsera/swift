import type { CanvasApi } from '../canvas/Canvas';
import { checkLine, LineSplitter, type Op } from './ops';
import { buildSystemPrompt, MAX_TREE, treeContext } from './prompt';
export type SayEvent = { kind: 'delta'; text: string } | { kind: 'done'; usage?: { input: number; output: number } } | { kind: 'error'; text: string };
/** What the helper client offers Say: send a request, get streamed events (the real one is a WebSocket; tests pass a fake). */
/** An image sent with a Say (png or jpeg, base64); the helper validates it again and refuses anything else. */
export type SayImage = { mediaType: 'image/png' | 'image/jpeg'; data: string };
export type SayTransport = (system: string, request: string, onEvent: (e: SayEvent) => void, images?: SayImage[]) => void;
export type SayResult = { applied: Op[]; asked: string[]; rejected: { line: string; error: string }[]; firstMs: number | null; totalMs: number; snapshot: string; error?: string; usage?: { input: number; output: number } };
export const BRAND_TOKENS: Record<string, string> = { '--ac': '#0a84ff', '--ok': '#30d158', '--warn': '#ffb340', '--bg': '#0b0b0f', '--fg': '#f5f5f7', '--blur': '24px', '--rad': '28px', '--font': 'Inter, system-ui, sans-serif' };
async function applyOp(api: CanvasApi, frameId: string, root: string, op: Op): Promise<boolean> {
  switch (op.op) {
    case 'set': return (await api.edit(frameId, op.id, op.prop, op.value)).ok;
    case 'token': return (await api.edit(frameId, root, op.name, op.value)).ok;
    case 'text': return api.text(frameId, op.id, op.value);
    case 'add': return api.add(frameId, op.parent, op.html);
    case 'remove': return api.remove(frameId, op.id);
    case 'ask': return true;
  }
}
/** One Say: snapshot (for one-step undo), build the prompt from the frame, stream ops, validate each line as it completes and apply the good ones at once. */
export async function runSay(a: { api: CanvasApi; send: SayTransport; frameId: string; root: string; request: string; now?: () => number; signal?: AbortSignal; tokens?: Record<string, string>; selected?: string }): Promise<SayResult> {
  const now = a.now ?? (() => performance.now()); const t0 = now();
  const snapshot = await a.api.snapshot(a.frameId); const tree = await a.api.tree(a.frameId); const ids = new Set(tree.map((n) => n.id));
  const selectedHtml = a.selected && ids.has(a.selected) && snapshot.length > MAX_TREE ? await a.api.outer(a.frameId, a.selected) : undefined;
  const system = buildSystemPrompt({ tokens: a.tokens ?? BRAND_TOKENS, ids: [...ids], tree: treeContext({ html: snapshot, tree, selectedHtml }) });
  const res: SayResult = { applied: [], asked: [], rejected: [], firstMs: null, totalMs: 0, snapshot };
  const splitter = new LineSplitter(); let chain: Promise<void> = Promise.resolve();
  const handle = (line: string) => { chain = chain.then(async () => {
    if (a.signal?.aborted) return; // cancelled: late lines from the helper are dropped, never applied
    const c = checkLine(line, ids); if (!c.ok) { res.rejected.push({ line: line.slice(0, 120), error: c.error }); return; }
    if (c.op.op === 'ask') { res.asked.push(c.op.value); return; }
    if (await applyOp(a.api, a.frameId, a.root, c.op)) { res.applied.push(c.op); if (res.firstMs === null) res.firstMs = now() - t0; } else res.rejected.push({ line: line.slice(0, 120), error: 'apply failed' });
  }); };
  await new Promise<void>((resolve) => { if (a.signal?.aborted) { res.error = 'cancelled'; return resolve(); } a.signal?.addEventListener('abort', () => { res.error = 'cancelled'; resolve(); }, { once: true }); a.send(system, a.request, (e) => {
    if (e.kind === 'delta') splitter.push(e.text).forEach(handle);
    else { if (e.kind === 'error' && !res.error) res.error = e.text; if (e.kind === 'done' && e.usage) res.usage = e.usage; splitter.flush().forEach(handle); resolve(); }
  }); });
  await chain; res.totalMs = now() - t0; return res;
}

const sumUsage = (a?: SayResult['usage'], b?: SayResult['usage']) => (a || b ? { input: (a?.input ?? 0) + (b?.input ?? 0), output: (a?.output ?? 0) + (b?.output ?? 0) } : undefined);
/** Errors worth one repair turn: malformed output. "unknown id" is a decision (the element is not there), not a typo, so it is not retried. */
export const isRepairable = (error: string): boolean => !error.startsWith('unknown');
/** Say, then ONE repair turn for repairable rejected lines (the repair sees the already-updated frame). Undo still restores the first snapshot. */
export async function runSayRepairing(a: Parameters<typeof runSay>[0]): Promise<SayResult & { repaired: number }> {
  const first = await runSay(a); const fixable = first.rejected.filter((x) => isRepairable(x.error));
  if (first.error || fixable.length === 0 || a.signal?.aborted) return { ...first, repaired: 0 };
  const note = fixable.map((f) => `${f.error}: ${f.line}`).join('; ');
  const second = await runSay({ ...a, request: `${a.request}\n\nSome of your operations were invalid (${note}). Reply with ONLY the corrected operations for those lines.` });
  return { ...first, applied: [...first.applied, ...second.applied], asked: [...first.asked, ...second.asked], rejected: [...first.rejected.filter((x) => !isRepairable(x.error)), ...second.rejected], totalMs: first.totalMs + second.totalMs, error: second.error, usage: sumUsage(first.usage, second.usage), repaired: second.applied.length };
}
