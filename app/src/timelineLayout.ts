import type { Timeline } from './motion';
/** The Motion strip's geometry as percentages of the timeline width, so the view is plain CSS and this is testable: a ruler (a tick every 0.4 s or 0.5 s), one row per track with its keyframe bar and diamonds, and the playhead. Pure. */
export type TlRow = { id: string; label: string; sub: string; bar: { left: number; width: number }; keys: { left: number; t: number; ease: string }[] };
export type TlLayout = { ruler: { left: number; label: string }[]; rows: TlRow[]; playhead: number; end: number };
const pct = (t: number, end: number): number => (end > 0 ? Math.min(100, Math.max(0, (t / end) * 100)) : 0);
export function layoutTimeline(tl: Timeline, t: number): TlLayout {
  const last = tl.tracks.reduce((m, x) => Math.max(m, x.keys[x.keys.length - 1]?.t ?? 0), 0); const end = Math.max(tl.duration, last, 1); const step = end <= 1200 ? 200 : end <= 3000 ? 400 : end <= 6000 ? 1000 : 2000;
  const ruler: TlLayout['ruler'] = []; for (let x = 0; x <= end; x += step) ruler.push({ left: pct(x, end), label: step >= 1000 ? `${x / 1000}s` : `${(x / 1000).toFixed(1)}s` });
  const rows: TlRow[] = tl.tracks.filter((x) => x.keys.length > 0).map((x) => { const a = x.keys[0]!.t, b = x.keys[x.keys.length - 1]!.t; return { id: `${x.frame}/${x.el}/${x.prop}`, label: x.el, sub: `${x.prop} ${x.keys.map((k) => k.v).join(' → ')}`, bar: { left: pct(a, end), width: Math.max(0.8, pct(b, end) - pct(a, end)) }, keys: x.keys.map((k) => ({ left: pct(k.t, end), t: k.t, ease: k.ease })) }; });
  return { ruler, rows, playhead: pct(t, end), end };
}
