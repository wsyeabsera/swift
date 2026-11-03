/** Arrow-key nudge: only elements that are positioned (absolute/fixed/relative) with pixel left/top; anything else is left alone. */
export type NudgeProps = { position?: string; left?: string; top?: string; translate?: string };
const px = (v: string | undefined): number | null => { const m = /^(-?\d+(?:\.\d+)?)px$/.exec((v ?? '').trim()); return m ? Number(m[1]) : null; };
export function nudge(p: NudgeProps, key: string, shift: boolean): { prop: string; value: string } | null {
  const step = shift ? 10 : 1; const d = key === 'ArrowLeft' ? [-step, 0] : key === 'ArrowRight' ? [step, 0] : key === 'ArrowUp' ? [0, -step] : key === 'ArrowDown' ? [0, step] : null; if (!d) return null;
  const s = moveStart(p); if (!s) return null;
  if (s.mode === 'translate') return { prop: 'translate', value: translated(s, d[0]!, d[1]!) };
  const prop = d[0] ? 'left' : 'top'; return { prop, value: `${Math.round(((d[0] ? s.left : s.top) + (d[0] || d[1]!)) * 100) / 100}px` };
}
/** Drag-to-move: the element's current pixel position, or null when it cannot be moved by left/top (static, auto or percent offsets). */
export function startPos(p: NudgeProps): { left: number; top: number } | null {
  if (!['absolute', 'fixed', 'relative'].includes(p.position ?? '')) return null; const left = px(p.left), top = px(p.top); return left === null || top === null ? null : { left, top };
}
/** Where the element goes after a drag of (dx, dy) world pixels: whole pixels. */
export const movedPos = (s: { left: number; top: number }, dx: number, dy: number): { left: string; top: string } => ({ left: `${Math.round(s.left + dx)}px`, top: `${Math.round(s.top + dy)}px` });
/** Resize by dragging the bottom-right handle: whole pixels, never below 4 px. */
export const resizedSize = (s: { w: number; h: number }, dw: number, dh: number): { width: string; height: string } => ({ width: `${Math.max(4, Math.round(s.w + dw))}px`, height: `${Math.max(4, Math.round(s.h + dh))}px` });

/** Elements without pixel left/top (static flow, auto or percent offsets) move with the CSS `translate` property: layout stays put, only the paint shifts. Returns the current offset (none = 0,0) or null when it is not in pixels. */
export function startTranslate(p: NudgeProps): { x: number; y: number } | null {
  const t = (p.translate ?? '').trim(); if (t === '' || t === 'none') return { x: 0, y: 0 };
  const m = /^(-?\d+(?:\.\d+)?)px(?:\s+(-?\d+(?:\.\d+)?)px)?$/.exec(t); return m ? { x: Number(m[1]), y: Number(m[2] ?? 0) } : null;
}
export const translated = (s: { x: number; y: number }, dx: number, dy: number): string => `${Math.round(s.x + dx)}px ${Math.round(s.y + dy)}px`;
/** One move model for drag and nudge: left/top when the element has them, else translate. */
export type MoveStart = { mode: 'pos'; left: number; top: number } | { mode: 'translate'; x: number; y: number };
export function moveStart(p: NudgeProps): MoveStart | null { const a = startPos(p); if (a) return { mode: 'pos', ...a }; const t = startTranslate(p); return t ? { mode: 'translate', ...t } : null; }
export function moveEdits(s: MoveStart, dx: number, dy: number): { prop: string; value: string }[] {
  if (s.mode === 'pos') { const p = movedPos(s, dx, dy); return [{ prop: 'left', value: p.left }, { prop: 'top', value: p.top }]; }
  return [{ prop: 'translate', value: translated(s, dx, dy) }];
}
