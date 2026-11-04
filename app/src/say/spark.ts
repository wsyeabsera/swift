import type { CanvasApi } from '../canvas/Canvas';
import type { FrameDef } from '../canvas/fixtures';
import { runSay, type SayResult, type SayTransport } from './say';
/** Spark: several directions at once. Each direction gets its own frame (a clone of the base frame) and its own Say, streamed in parallel. */
export const DIRECTIONS = [
  { name: 'Warm and cozy', prompt: 'Give this a warm, inviting feel: warmer colours, softer contrast, rounder shapes, still easy to read.' },
  { name: 'Bold', prompt: 'Make this bold and high-contrast: much larger type, a simpler layout, one clear focal point.' },
  { name: 'Calm and minimal', prompt: 'Make this calm and minimal: more empty space, quieter colours, fewer visual elements.' },
  { name: 'Playful', prompt: 'Make this playful and colourful with rounded shapes and friendly accents, using the brand colours.' },
] as const; // project-agnostic on purpose: Swift Canvas designs many projects, so no device or room is named here
/** Takes 5..12 are a base direction plus one of these twists, so no two prompts repeat. */
const TWISTS = [{ name: 'night mode', text: 'Take it to a dark, night-time palette.' }, { name: 'big and airy', text: 'Push the scale up and give everything generous spacing.' }] as const;
export const MAX_SPARK = DIRECTIONS.length * (TWISTS.length + 1);
export const directionFor = (i: number): { name: string; prompt: string } => { const d = DIRECTIONS[i % DIRECTIONS.length]!, t = TWISTS[Math.floor(i / DIRECTIONS.length) - 1]; return t ? { name: `${d.name} · ${t.name}`, prompt: `${d.prompt} ${t.text}` } : d; };
/** The helper runs at most 4 Says at once: more takes queue at the transport and start, in order, as slots free up (a slot frees on done/error or when the take is cancelled). */
export const MAX_INFLIGHT = 4;
export function limitSays(send: SayTransport, max = MAX_INFLIGHT): (signal: AbortSignal) => SayTransport {
  let active = 0; const waiting: (() => void)[] = []; const pump = () => { while (active < max && waiting.length) { active++; waiting.shift()!(); } };
  return (signal) => (system, request, on, images) => { waiting.push(() => { let freed = false; const free = () => { if (!freed) { freed = true; active--; pump(); } };
    if (signal.aborted) return free(); signal.addEventListener('abort', free, { once: true }); send(system, request, (e) => { if (e.kind !== 'delta') free(); on(e); }, images); }); pump(); };
}
/** Where take `i` of `n` goes: a grid above the base frame, two per row. */
export function takeFrame(base: FrameDef, i: number, id: string, name: string, html: string): FrameDef {
  return { id, root: base.root, title: `${base.title.split(' ·')[0]} · ${name}`, x: base.x + (i % 2) * (base.w + 140), y: base.y - (base.h + 220) * (1 + Math.floor(i / 2)), w: base.w, h: base.h, html };
}
export type SparkResult = { takes: { id: string; name: string; result: SayResult }[]; firstPaintMs: number | null; totalMs: number };
async function waitFrame(api: CanvasApi, id: string, timeoutMs = 4000): Promise<boolean> {
  const t0 = performance.now(); while (performance.now() - t0 < timeoutMs) { if ((await api.snapshot(id)).length > 0) return true; await new Promise((r) => setTimeout(r, 40)); } return false;
}
export async function runSpark(a: { api: CanvasApi; send: SayTransport; base: FrameDef; n: number; nextId: () => string; addFrames: (f: FrameDef[]) => void; signal?: AbortSignal; tokens?: Record<string, string>; extra?: string; running?: Map<string, AbortController>; onTakeDone?: (id: string) => void }): Promise<SparkResult> {
  const t0 = performance.now(); const html = await a.api.snapshot(a.base.id); const dirs = Array.from({ length: Math.max(1, Math.min(a.n, MAX_SPARK)) }, (_, i) => directionFor(i)); const gate = limitSays(a.send);
  const frames = dirs.map((d, i) => takeFrame(a.base, i, a.nextId(), d.name, html)); a.addFrames(frames);
  await Promise.all(frames.map((f) => waitFrame(a.api, f.id))); a.api.fitTo(frames.map((f) => f.id)); // only now does the live API know the new frames
  let firstPaint: number | null = null;
  const takes = await Promise.all(frames.map(async (f, i) => {
    const dir = dirs[i]!;
    const own = new AbortController(); a.running?.set(f.id, own); const signal = a.signal ? AbortSignal.any([a.signal, own.signal]) : own.signal; // cancel one take, or all of them
    const result = await runSay({ api: a.api, send: gate(signal), frameId: f.id, root: f.root, request: `${dir.prompt} Emit the single most visible change FIRST (one op per line), then at most 6 more.${a.extra ? `\n\n${a.extra}` : ''}`, signal, tokens: a.tokens }); a.running?.delete(f.id); a.onTakeDone?.(f.id);
    if (result.firstMs !== null && firstPaint === null) firstPaint = performance.now() - t0; return { id: f.id, name: dir.name, result };
  }));
  return { takes, firstPaintMs: firstPaint, totalMs: performance.now() - t0 };
}
/** A Spark take is a frame `<base>-t<n>` that was not kept. Discarding removes the takes (the user keeps the ones they like first). */
export const isTake = (f: FrameDef): boolean => /-t\d+$/.test(f.id) && !f.kept;
export const discardTakes = (frames: FrameDef[]): FrameDef[] => frames.filter((f) => !isTake(f));
export const keepTake = (frames: FrameDef[], id: string): FrameDef[] => frames.map((f) => (f.id === id && isTake(f) ? { ...f, kept: true } : f));
/** Each take is a live iframe (~2.5 MB) plus a Claude session: cap the unreviewed takes so Spark cannot pile up silently. */
export const MAX_TAKES = 12; // one Spark of 12 (on request, ~3 GB for the sessions); the default Spark is 4
export const canSpark = (frames: FrameDef[], n: number): { ok: true } | { ok: false; reason: string } => { const open = frames.filter(isTake).length; return open + n > MAX_TAKES ? { ok: false, reason: `${open} takes waiting: keep or discard some first (max ${MAX_TAKES})` } : { ok: true }; };
