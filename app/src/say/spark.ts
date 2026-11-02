import type { CanvasApi } from '../canvas/Canvas';
import type { FrameDef } from '../canvas/fixtures';
import { runSay, type SayResult, type SayTransport } from './say';
/** Spark: several directions at once. Each direction gets its own frame (a clone of the base frame) and its own Say, streamed in parallel. */
export const DIRECTIONS = [
  { name: 'Warm living room', prompt: 'Give this a warm, cozy feel for a living room at night: warmer colours, softer contrast, still easy to read from the couch.' },
  { name: 'Bold from the couch', prompt: 'Make this bold and high-contrast for reading from 3 metres away: much larger type, a simpler layout.' },
  { name: 'Calm and minimal', prompt: 'Make this calm and minimal: more empty space, quieter colours, fewer visual elements.' },
  { name: 'Playful', prompt: 'Make this playful and colourful with rounded shapes and friendly accents, using the brand colours.' },
] as const;
/** Where take `i` of `n` goes: a grid above the base frame, two per row. */
export function takeFrame(base: FrameDef, i: number, id: string, name: string, html: string): FrameDef {
  return { id, root: base.root, title: `${base.title.split(' ·')[0]} · ${name}`, x: base.x + (i % 2) * (base.w + 140), y: base.y - (base.h + 220) * (1 + Math.floor(i / 2)), w: base.w, h: base.h, html };
}
export type SparkResult = { takes: { id: string; name: string; result: SayResult }[]; firstPaintMs: number | null; totalMs: number };
async function waitFrame(api: CanvasApi, id: string, timeoutMs = 4000): Promise<boolean> {
  const t0 = performance.now(); while (performance.now() - t0 < timeoutMs) { if ((await api.snapshot(id)).length > 0) return true; await new Promise((r) => setTimeout(r, 40)); } return false;
}
export async function runSpark(a: { api: CanvasApi; send: SayTransport; base: FrameDef; n: number; nextId: () => string; addFrames: (f: FrameDef[]) => void }): Promise<SparkResult> {
  const t0 = performance.now(); const html = await a.api.snapshot(a.base.id); const dirs = DIRECTIONS.slice(0, Math.max(1, Math.min(a.n, DIRECTIONS.length)));
  const frames = dirs.map((d, i) => takeFrame(a.base, i, a.nextId(), d.name, html)); a.addFrames(frames);
  await Promise.all(frames.map((f) => waitFrame(a.api, f.id))); a.api.fitTo(frames.map((f) => f.id)); // only now does the live API know the new frames
  let firstPaint: number | null = null;
  const takes = await Promise.all(frames.map(async (f, i) => {
    const dir = dirs[i]!;
    const result = await runSay({ api: a.api, send: a.send, frameId: f.id, root: f.root, request: dir.prompt });
    if (result.firstMs !== null && firstPaint === null) firstPaint = performance.now() - t0; return { id: f.id, name: dir.name, result };
  }));
  return { takes, firstPaintMs: firstPaint, totalMs: performance.now() - t0 };
}
