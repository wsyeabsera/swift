// Pure viewport math. screen = world * s + (x, y). No React, no DOM: tested directly.
export type View = { x: number; y: number; s: number };
export type Rect = { x: number; y: number; w: number; h: number };
export const MIN_S = 0.05;
export const MAX_S = 8;
export const clampScale = (s: number): number => Math.min(MAX_S, Math.max(MIN_S, s));
/** Zoom by `factor` keeping the world point under screen point (px, py) fixed. */
export function zoomAt(v: View, px: number, py: number, factor: number): View {
  const s = clampScale(v.s * factor); const k = s / v.s;
  return { s, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
}
export const panBy = (v: View, dx: number, dy: number): View => ({ ...v, x: v.x + dx, y: v.y + dy });
export const screenToWorld = (v: View, sx: number, sy: number): { x: number; y: number } => ({ x: (sx - v.x) / v.s, y: (sy - v.y) / v.s });
/** Does the frame intersect the viewport (vw x vh), with an optional margin in screen px? */
export function isVisible(f: Rect, v: View, vw: number, vh: number, margin = 0): boolean {
  const l = f.x * v.s + v.x; const t = f.y * v.s + v.y;
  return l - margin < vw && l + f.w * v.s + margin > 0 && t - margin < vh && t + f.h * v.s + margin > 0;
}
/** A view that fits all rects in the viewport with `pad` screen px around them. */
export function fit(rects: Rect[], vw: number, vh: number, pad = 80): View {
  if (rects.length === 0) return { x: 0, y: 0, s: 1 };
  const x0 = Math.min(...rects.map((r) => r.x)); const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w)); const y1 = Math.max(...rects.map((r) => r.y + r.h));
  const s = clampScale(Math.min((vw - 2 * pad) / (x1 - x0), (vh - 2 * pad) / (y1 - y0)));
  return { s, x: (vw - (x1 - x0) * s) / 2 - x0 * s, y: (vh - (y1 - y0) * s) / 2 - y0 * s };
}
export const transformCss = (v: View): string => `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
