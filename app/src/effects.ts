// Frame-budget meter for animated effects. An ESTIMATE from one measured point per device, not a profiler:
// TCL TV GPU, full-screen 1920x1080 animated gradient = ~150 ms per update (tvdash); the shipped aurora renders at 1/4 resolution per side, ~15 updates/s, 13-19 ms.
export type Device = 'tv' | 'phone' | 'desktop';
export type Effect = { kind: 'gradient' | 'blur' | 'noise'; scale: number; fps: number }; // scale = render size per side (1 = native, 0.25 = quarter), fps = updates per second
export const DEVICE_SIZE: Record<Device, { w: number; h: number }> = { tv: { w: 1920, h: 1080 }, phone: { w: 390, h: 844 }, desktop: { w: 1280, h: 800 } };
const MS_PER_MPX: Record<Device, number> = { tv: 150 / ((1920 * 1080) / 1e6), phone: 6, desktop: 3 }; // a native gradient; TV measured, phone/desktop are rough GPU-class guesses, marked as such in the UI
const KIND_WEIGHT: Record<Effect['kind'], number> = { gradient: 1, blur: 1.6, noise: 0.5 };
export const BUDGET: Record<Device, { frameMs: number; load: number }> = { tv: { frameMs: 20, load: 0.35 }, phone: { frameMs: 8, load: 0.3 }, desktop: { frameMs: 12, load: 0.3 } }; // per update, and the share of time the GPU may spend on effects
export const AURORA: Effect[] = [{ kind: 'gradient', scale: 0.25, fps: 15 }, { kind: 'gradient', scale: 0.25, fps: 15 }];
export const effectMs = (e: Effect, d: Device): number => { const { w, h } = DEVICE_SIZE[d]; return KIND_WEIGHT[e.kind] * MS_PER_MPX[d] * ((w * e.scale * h * e.scale) / 1e6); };
export type Meter = { frameMs: number; load: number; over: boolean; reason: string };
/** Cost of one update of the whole stack (all effects redraw together at the fastest fps) and the share of GPU time it takes. */
export function meter(stack: Effect[], d: Device): Meter {
  const frameMs = stack.reduce((n, e) => n + effectMs(e, d), 0); const fps = stack.reduce((m, e) => Math.max(m, e.fps), 0); const load = (frameMs * fps) / 1000; const b = BUDGET[d];
  const reasons = [frameMs > b.frameMs ? `${frameMs.toFixed(0)} ms per update, budget ${b.frameMs}` : '', load > b.load ? `${Math.round(load * 100)}% GPU, budget ${Math.round(b.load * 100)}%` : ''].filter(Boolean);
  return { frameMs, load, over: reasons.length > 0, reason: reasons.join(' · ') };
}
const SCALES = [1, 0.5, 0.25, 0.125]; const RATES = [60, 30, 15, 10];
/** The mildest change that fits the budget: first a lower render scale on the most expensive effect, then a lower update rate; null when nothing fits (drop an effect). */
export function suggest(stack: Effect[], d: Device): { stack: Effect[]; text: string } | null {
  if (!meter(stack, d).over) return null; let cur = stack.map((e) => ({ ...e })); const steps: string[] = [];
  for (let guard = 0; guard < 40 && meter(cur, d).over; guard++) {
    const i = cur.reduce((bi, e, k) => (effectMs(e, d) > effectMs(cur[bi]!, d) ? k : bi), 0); const e = cur[i]!; const s = SCALES.find((x) => x < e.scale);
    if (s !== undefined) { cur[i] = { ...e, scale: s }; steps.push(`${e.kind} ${i + 1} to ${s} scale`); continue; }
    const r = RATES.find((x) => x < Math.max(...cur.map((c) => c.fps))); if (r === undefined) return null; cur = cur.map((c) => ({ ...c, fps: Math.min(c.fps, r) })); steps.push(`updates to ${r}/s`);
  }
  return meter(cur, d).over ? null : { stack: cur, text: `Try ${steps.join(', ')}: ${meter(cur, d).frameMs.toFixed(0)} ms per update` };
}

/** An effect layer as real frame markup: a non-interactive full-frame element carrying its settings in data attributes, so the meter can read them back from the frame itself.
 *  Update rate is real (a stepped animation: `steps(n)` limits repaints to `fps` per second); render scale is an intent the layer is drawn for (a smaller raster scaled up) and is what the meter charges for. */
export type FxKind = Effect['kind'];
const LOOP_S = 12;
const FX_STYLE: Record<FxKind, (scale: number) => string> = {
  gradient: () => 'background:radial-gradient(60% 50% at 20% 30%,rgba(124,240,208,.55),transparent 70%),radial-gradient(50% 60% at 80% 70%,rgba(120,80,255,.5),transparent 70%),radial-gradient(40% 40% at 60% 20%,rgba(10,132,255,.45),transparent 70%)',
  blur: () => 'backdrop-filter:blur(24px);background:rgba(255,255,255,.04)',
  noise: () => "background-image:repeating-conic-gradient(rgba(255,255,255,.05) 0 25%,transparent 0 50%);background-size:4px 4px",
};
export function fxHtml(id: string, e: Effect): string {
  const steps = Math.max(1, Math.round(LOOP_S * e.fps)); const s = Math.min(1, Math.max(0.05, e.scale));
  return `<div id="${id}" data-fx="${e.kind}" data-fx-scale="${s}" data-fx-fps="${e.fps}" style="position:absolute;left:0;top:0;width:${(100 * s).toFixed(2)}%;height:${(100 * s).toFixed(2)}%;transform:scale(${(1 / s).toFixed(3)});transform-origin:0 0;pointer-events:none;will-change:transform;${FX_STYLE[e.kind](s)};animation:${id}-a ${LOOP_S}s steps(${steps}) infinite"><style>@keyframes ${id}-a{from{filter:hue-rotate(0deg)}to{filter:hue-rotate(360deg)}}</style></div>`;
}
/** The effect layers in a frame's markup, in order (what the meter charges for). `on` is false for a layer switched off (its style says display:none): it stays in the frame, the meter does not charge for it. */
export function parseFx(html: string): { id: string; effect: Effect; on: boolean }[] {
  const out: { id: string; effect: Effect; on: boolean }[] = []; for (const m of html.matchAll(/<div id="([^"]+)" data-fx="(gradient|blur|noise)" data-fx-scale="([\d.]+)" data-fx-fps="(\d+)"[^>]*>/g)) { const scale = Number(m[3]), fps = Number(m[4]); if (scale > 0 && scale <= 1 && fps > 0 && fps <= 60) out.push({ id: m[1]!, effect: { kind: m[2] as FxKind, scale, fps }, on: !/display:\s*none/i.test(m[0]) }); } return out;
}
/** The next free `fx-<kind>-<n>` id among the ids already in the frame. */
export function fxId(html: string, kind: FxKind): string { let n = 1; while (html.includes(`id="fx-${kind}-${n}"`)) n++; return `fx-${kind}-${n}`; }
export const FX_PRESETS: Record<'aurora' | 'heavy' | 'grain', Effect[]> = { aurora: AURORA, heavy: [{ kind: 'gradient', scale: 1, fps: 30 }, { kind: 'blur', scale: 0.5, fps: 30 }], grain: [{ kind: 'noise', scale: 0.5, fps: 10 }] };
