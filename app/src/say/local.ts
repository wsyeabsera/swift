/** Local tier: a handful of unambiguous requests on the selected element are answered by rules, not by Claude (instant, free, deterministic).
 *  Anything it does not recognise returns null and goes to Claude. It only ever produces `set` edits of a known property. */
export type LocalEdit = { prop: string; value: string };
export type LocalCtx = { get: (prop: string) => Promise<string | undefined> };
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const NAMES = new Set(['white', 'black', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray', 'grey', 'teal', 'cyan', 'transparent']);
const color = (w: string): string | null => { const c = w.toLowerCase().replace(/[.!]$/, ''); return HEX.test(c) || NAMES.has(c) ? c : null; };
const px = (v: string | undefined): number | null => { const m = /^(-?\d+(?:\.\d+)?)px$/.exec((v ?? '').trim()); return m ? Number(m[1]) : null; };
const round = (n: number) => String(Math.round(n * 100) / 100);
export async function localEdits(request: string, ctx: LocalCtx): Promise<LocalEdit[] | null> {
  const t = request.trim().toLowerCase().replace(/^(please\s+)?(make\s+(it|this)\s+|set\s+(it\s+)?)?/, '').replace(/[.!]+$/, '').replace(/\s+/g, ' ');
  if (!t) return null;
  const scale = /^(a bit |slightly )?(bigger|larger)$/.test(t) ? (t.startsWith('a bit') || t.startsWith('slightly') ? 1.1 : 1.25) : /^(a bit |slightly )?smaller$/.test(t) ? (t.startsWith('a bit') || t.startsWith('slightly') ? 0.9 : 0.8) : null;
  if (scale !== null) { const fs = px(await ctx.get('font-size')); return fs && fs > 0 ? [{ prop: 'font-size', value: `${round(fs * scale)}px` }] : null; }
  if (t === 'hide' || t === 'hidden' || t === 'invisible') return [{ prop: 'opacity', value: '0' }];
  if (t === 'show' || t === 'visible') return [{ prop: 'opacity', value: '1' }];
  let m = /^opacity (?:to )?(\d{1,3})\s*%$/.exec(t); if (m) { const n = Number(m[1]); return n <= 100 ? [{ prop: 'opacity', value: round(n / 100) }] : null; }
  m = /^(?:(text |font )?colou?r|background(?: colou?r)?|bg)\s+(?:to\s+)?(\S+)$/.exec(t);
  if (m) { const c = color(m[2]!); if (!c) return null; return [{ prop: /^(background|bg)/.test(t) ? 'background-color' : 'color', value: c }]; }
  m = /^(?:font[- ]?size|size|width|height)\s+(?:to\s+)?(\d{1,4})\s*(?:px)?$/.exec(t);
  if (m) return [{ prop: t.startsWith('width') ? 'width' : t.startsWith('height') ? 'height' : 'font-size', value: `${m[1]}px` }];
  return null;
}
