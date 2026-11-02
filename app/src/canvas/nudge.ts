/** Arrow-key nudge: only elements that are positioned (absolute/fixed/relative) with pixel left/top; anything else is left alone. */
export type NudgeProps = { position?: string; left?: string; top?: string };
const px = (v: string | undefined): number | null => { const m = /^(-?\d+(?:\.\d+)?)px$/.exec((v ?? '').trim()); return m ? Number(m[1]) : null; };
export function nudge(p: NudgeProps, key: string, shift: boolean): { prop: 'left' | 'top'; value: string } | null {
  if (!['absolute', 'fixed', 'relative'].includes(p.position ?? '')) return null; const step = shift ? 10 : 1;
  const d = key === 'ArrowLeft' ? ['left', -step] : key === 'ArrowRight' ? ['left', step] : key === 'ArrowUp' ? ['top', -step] : key === 'ArrowDown' ? ['top', step] : null; if (!d) return null;
  const prop = d[0] as 'left' | 'top'; const cur = px(p[prop]); if (cur === null) return null; return { prop, value: `${Math.round((cur + (d[1] as number)) * 100) / 100}px` };
}
/** Drag-to-move: the element's current pixel position, or null when it cannot be moved by left/top (static, auto or percent offsets). */
export function startPos(p: NudgeProps): { left: number; top: number } | null {
  if (!['absolute', 'fixed', 'relative'].includes(p.position ?? '')) return null; const left = px(p.left), top = px(p.top); return left === null || top === null ? null : { left, top };
}
/** Where the element goes after a drag of (dx, dy) world pixels: whole pixels. */
export const movedPos = (s: { left: number; top: number }, dx: number, dy: number): { left: string; top: string } => ({ left: `${Math.round(s.left + dx)}px`, top: `${Math.round(s.top + dy)}px` });
/** Resize by dragging the bottom-right handle: whole pixels, never below 4 px. */
export const resizedSize = (s: { w: number; h: number }, dw: number, dh: number): { width: string; height: string } => ({ width: `${Math.max(4, Math.round(s.w + dw))}px`, height: `${Math.max(4, Math.round(s.h + dh))}px` });
