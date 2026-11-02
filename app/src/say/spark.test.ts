import { expect, test, vi } from 'vitest';
import type { CanvasApi } from '../canvas/Canvas';
import type { FrameDef } from '../canvas/fixtures';
import { canSpark, DIRECTIONS, discardTakes, isTake, keepTake, runSpark, takeFrame } from './spark';
import type { SayEvent } from './say';
const base: FrameDef = { id: 'tv', root: 'tv', title: 'TV · Idle 1920×1080', x: 0, y: 0, w: 1920, h: 1080, html: '<div id="tv"></div>' };
test('takes are laid out above the base, two per row, without overlapping', () => {
  const t = [0, 1, 2, 3].map((i) => takeFrame(base, i, `t${i}`, 'x', '')); expect(t[0]!.y).toBeLessThan(0); expect(t[1]!.x).toBeGreaterThan(t[0]!.x + base.w); expect(t[2]!.y).toBeLessThan(t[0]!.y); expect(new Set(t.map((f) => `${f.x},${f.y}`)).size).toBe(4); expect(t[0]!.title).toBe('TV · x');
});
test('directions are distinct prompts', () => { expect(new Set(DIRECTIONS.map((d) => d.prompt)).size).toBe(DIRECTIONS.length); });
test('runSpark clones the base into n frames and runs one Say per frame in parallel', async () => {
  const seen: string[] = []; const added: FrameDef[] = [];
  const api = { snapshot: vi.fn(async (id: string) => (id === 'tv' ? '<div id="tv"></div>' : added.some((f) => f.id === id) ? '<div id="tv"></div>' : '')), tree: vi.fn(async () => [{ id: 'tv', parent: null, depth: 0, tag: 'div', text: '' }]),
    edit: vi.fn(async () => ({ ok: true, ms: 1, before: '' })), fitTo: vi.fn() } as unknown as CanvasApi; let n = 0;
  const send = (_s: string, request: string, on: (e: SayEvent) => void) => { seen.push(request); setTimeout(() => { on({ kind: 'delta', text: '{"op":"set","id":"tv","prop":"opacity","value":"0.9"}\n' }); on({ kind: 'done' }); }, 5); };
  const r = await runSpark({ api, send, base, n: 3, nextId: () => `tv-t${++n}`, addFrames: (f) => added.push(...f) });
  expect(added.map((f) => f.id)).toEqual(['tv-t1', 'tv-t2', 'tv-t3']); expect(new Set(seen).size).toBe(3); expect(seen.every((r) => r.includes('most visible change FIRST'))).toBe(true); expect(r.takes.every((t) => t.result.applied.length === 1)).toBe(true); expect(r.firstPaintMs).not.toBeNull(); expect(api.fitTo).toHaveBeenCalledWith(['tv-t1', 'tv-t2', 'tv-t3']);
});
test('keep promotes one take, discard removes the rest and never touches real frames', () => {
  const f = [base, { ...base, id: 'tv-t1' }, { ...base, id: 'tv-t2' }]; const kept = keepTake(f, 'tv-t2');
  expect(isTake(kept[1]!)).toBe(true); expect(isTake(kept[2]!)).toBe(false); expect(discardTakes(kept).map((x) => x.id)).toEqual(['tv', 'tv-t2']);
  expect(keepTake(f, 'tv')).toEqual(f); expect(discardTakes([base])).toEqual([base]);
});
test('spark is refused while too many takes are unreviewed', () => {
  const many = Array.from({ length: 5 }, (_, i) => ({ ...base, id: `tv-t${i + 1}` })); expect(canSpark([base], 4)).toEqual({ ok: true }); expect(canSpark(many, 3)).toEqual({ ok: true });
  const r = canSpark(many, 4); expect(r.ok).toBe(false); expect(r.ok === false && r.reason).toContain('5 takes waiting'); expect(canSpark(keepTake(many, 'tv-t1'), 4).ok).toBe(true);
});
test('cancelling one running take leaves the others finishing', async () => {
  const added: FrameDef[] = []; const running = new Map<string, AbortController>(); const emitters: Record<number, (e: SayEvent) => void> = {}; let k = 0;
  const api = { snapshot: async () => '<div id="tv"></div>', tree: async () => [{ id: 'tv', parent: null, depth: 0, tag: 'div', text: '' }], edit: async () => ({ ok: true, ms: 1, before: '' }), fitTo: () => {} } as unknown as CanvasApi; let n = 0;
  const p = runSpark({ api, send: (_s, _r, on) => { emitters[k++] = on; }, base, n: 3, nextId: () => `tv-t${++n}`, addFrames: (f) => added.push(...f), running });
  await new Promise((r) => setTimeout(r, 120)); expect([...running.keys()].sort()).toEqual(['tv-t1', 'tv-t2', 'tv-t3']);
  running.get('tv-t2')!.abort(); for (const i of [0, 1, 2]) { emitters[i]!({ kind: 'delta', text: '{"op":"set","id":"tv","prop":"opacity","value":"0.9"}\n' }); emitters[i]!({ kind: 'done' }); }
  const r = await p; expect(r.takes.map((t) => [t.id, t.result.applied.length, t.result.error])).toEqual([['tv-t1', 1, undefined], ['tv-t2', 0, 'cancelled'], ['tv-t3', 1, undefined]]); expect(running.size).toBe(0);
});
test('onTakeDone fires once per take, including cancelled ones', async () => {
  const done: string[] = []; const ac = new AbortController(); ac.abort(); let n = 0;
  const api = { snapshot: async () => '<div id="tv"></div>', tree: async () => [{ id: 'tv', parent: null, depth: 0, tag: 'div', text: '' }], fitTo: () => {} } as unknown as CanvasApi;
  await runSpark({ api, send: () => {}, base, n: 2, nextId: () => `tv-t${++n}`, addFrames: () => {}, signal: ac.signal, onTakeDone: (id) => done.push(id) }); expect(done.sort()).toEqual(['tv-t1', 'tv-t2']);
});
