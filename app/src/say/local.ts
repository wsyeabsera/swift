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
  let m0: RegExpExecArray | null;
  const scale = /^(a bit |slightly )?(bigger|larger)$/.test(t) ? (t.startsWith('a bit') || t.startsWith('slightly') ? 1.1 : 1.25) : /^(a bit |slightly )?smaller$/.test(t) ? (t.startsWith('a bit') || t.startsWith('slightly') ? 0.9 : 0.8) : null;
  if (scale !== null) { const fs = px(await ctx.get('font-size')); return fs && fs > 0 ? [{ prop: 'font-size', value: `${round(fs * scale)}px` }] : null; }
  if (t === 'hide' || t === 'hidden' || t === 'invisible') return [{ prop: 'opacity', value: '0' }];
  if (t === 'show' || t === 'visible') return [{ prop: 'opacity', value: '1' }];
  if (t === 'bold' || t === 'bolder') return [{ prop: 'font-weight', value: '700' }]; if (t === 'not bold' || t === 'normal weight' || t === 'lighter') return [{ prop: 'font-weight', value: t === 'lighter' ? '300' : '400' }];
  if (t === 'italic') return [{ prop: 'font-style', value: 'italic' }]; if (t === 'not italic') return [{ prop: 'font-style', value: 'normal' }];
  if (t === 'uppercase' || t === 'all caps') return [{ prop: 'text-transform', value: 'uppercase' }]; if (t === 'lowercase') return [{ prop: 'text-transform', value: 'lowercase' }];
  if (t === 'underline' || t === 'underlined') return [{ prop: 'text-decoration', value: 'underline' }]; if (t === 'no underline') return [{ prop: 'text-decoration', value: 'none' }];
  m0 = /^(?:text )?(?:align(?:ed)? )?(left|right|center|centre)(?: aligned)?$/.exec(t); if (m0 && /align|text/.test(t)) return [{ prop: 'text-align', value: m0[1] === 'centre' ? 'center' : m0[1]! }];
  if (/^(rounder|round(?:ed)? corners|more rounded)$/.test(t)) { const r = px(await ctx.get('border-radius')); return [{ prop: 'border-radius', value: `${round((r ?? 0) + 8)}px` }]; }
  if (/^(sharper|square corners|less rounded)$/.test(t)) { const r = px(await ctx.get('border-radius')); return r === null ? null : [{ prop: 'border-radius', value: t === 'square corners' ? '0px' : `${Math.max(0, Number(round(r - 8)))}px` }]; }
  if (/^(more |extra )?(padding|space inside)$/.test(t)) { const v = px(await ctx.get('padding-top')); return v === null ? null : [{ prop: 'padding', value: `${round(v + 8)}px` }]; }
  if (t === 'no border' || t === 'remove border') return [{ prop: 'border', value: 'none' }];
  if (/^(more )?letter spacing$|^wider$/.test(t)) { return [{ prop: 'letter-spacing', value: '0.05em' }]; }
  let m = /^opacity (?:to )?(\d{1,3})\s*%$/.exec(t); if (m) { const n = Number(m[1]); return n <= 100 ? [{ prop: 'opacity', value: round(n / 100) }] : null; }
  m = /^(?:(text |font )?colou?r|background(?: colou?r)?|bg)\s+(?:to\s+)?(\S+)$/.exec(t);
  if (m) { const c = color(m[2]!); if (!c) return null; return [{ prop: /^(background|bg)/.test(t) ? 'background-color' : 'color', value: c }]; }
  m = /^(?:font[- ]?size|size|width|height)\s+(?:to\s+)?(\d{1,4})\s*(?:px)?$/.exec(t);
  if (m) return [{ prop: t.startsWith('width') ? 'width' : t.startsWith('height') ? 'height' : 'font-size', value: `${m[1]}px` }];
  return null;
}
