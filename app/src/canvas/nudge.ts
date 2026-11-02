/** Arrow-key nudge: only elements that are positioned (absolute/fixed/relative) with pixel left/top; anything else is left alone. */
export type NudgeProps = { position?: string; left?: string; top?: string };
const px = (v: string | undefined): number | null => { const m = /^(-?\d+(?:\.\d+)?)px$/.exec((v ?? '').trim()); return m ? Number(m[1]) : null; };
export function nudge(p: NudgeProps, key: string, shift: boolean): { prop: 'left' | 'top'; value: string } | null {
  if (!['absolute', 'fixed', 'relative'].includes(p.position ?? '')) return null; const step = shift ? 10 : 1;
  const d = key === 'ArrowLeft' ? ['left', -step] : key === 'ArrowRight' ? ['left', step] : key === 'ArrowUp' ? ['top', -step] : key === 'ArrowDown' ? ['top', step] : null; if (!d) return null;
  const prop = d[0] as 'left' | 'top'; const cur = px(p[prop]); if (cur === null) return null; return { prop, value: `${Math.round((cur + (d[1] as number)) * 100) / 100}px` };
}
