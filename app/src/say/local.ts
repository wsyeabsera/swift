/** Local tier: a handful of unambiguous requests on the selected element are answered by rules, not by Claude (instant, free, deterministic).
 *  Anything it does not recognise returns null and goes to Claude. It only ever produces `set` edits of a known property. */
export type LocalEdit = { prop: string; value: string };
export type LocalCtx = { get: (prop: string) => Promise<string | undefined> };
import { moveEdits, moveStart } from '../canvas/nudge';
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const NAMES = new Set(['white', 'black', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray', 'grey', 'teal', 'cyan', 'transparent']);
const color = (w: string): string | null => { const c = w.toLowerCase().replace(/[.!]$/, ''); return HEX.test(c) || NAMES.has(c) ? c : null; };
const px = (v: string | undefined): number | null => { const m = /^(-?\d+(?:\.\d+)?)px$/.exec((v ?? '').trim()); return m ? Number(m[1]) : null; };
const round = (n: number) => String(Math.round(n * 100) / 100);
export async function localEdits(request: string, ctx: LocalCtx): Promise<LocalEdit[] | null> {
  const t = request.trim().toLowerCase().replace(/^(please\s+)?(make\s+(it|this)\s+|set\s+(it\s+)?)?/, '').replace(/[.!]+$/, '').replace(/\s+/g, ' ');
  if (!t) return null;
  // "make the clock bigger" / "make the text white": the SUBJECT is the selection already, only the predicate matters (a colour needs a subject to say text or background)
  let t2 = t; let subject = ''; const sm = /^make (?:the |this |that )([\w-]+) (.+)$/.exec(t); if (sm) { subject = sm[1]!; t2 = sm[2]!; }
  if (subject) { const c = color(t2); if (c) return [{ prop: /^(background|bg|card|panel|screen|page|backdrop)$/.test(subject) ? 'background-color' : /^(text|font|title|label|heading|caption|copy|clock|date)$/.test(subject) ? 'color' : '', value: c }].filter((e) => e.prop); }
  const pm = /^(?:increase |set |make )?(?:the )?padding (?:to )?(\d{1,3})\s*(?:px)?$/.exec(t2); if (pm) return [{ prop: 'padding', value: `${pm[1]}px` }];
  if (/^round(?: the)? corners more$/.test(t2)) t2 = 'rounder';
  if (t2 !== t) return localEdits(t2, ctx);
  const nm = /^(?:nudge|move) (?:the |this |it )?(?:[\w-]+ )?(up|down|left|right)(?: by)? (\d{1,4}) ?px$/.exec(t); // "nudge the title up 8 px": same move model as drag and arrow keys (left/top, else translate)
  if (nm) { const start = moveStart({ position: await ctx.get('position'), left: await ctx.get('left'), top: await ctx.get('top'), translate: await ctx.get('translate') }); if (!start) return null; const n = Number(nm[2]); const d = nm[1] === 'up' ? [0, -n] : nm[1] === 'down' ? [0, n] : nm[1] === 'left' ? [-n, 0] : [n, 0]; return moveEdits(start, d[0]!, d[1]!); }
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

const HEXES: Record<string, string> = { white: '#ffffff', black: '#000000', red: '#ff453a', orange: '#ff9f0a', yellow: '#ffd60a', green: '#30d158', blue: '#0a84ff', purple: '#bf5af2', pink: '#ff375f', gray: '#8e8e93', grey: '#8e8e93', teal: '#40c8e0', cyan: '#64d2ff' };
const WORDS: Record<string, string[]> = { accent: ['accent', 'ac', 'primary', 'brand'], background: ['bg', 'background', 'base', 'surface'], text: ['fg', 'text', 'tx', 'ink', 'foreground'], success: ['ok', 'success', 'good'], warning: ['warn', 'warning'], error: ['bad', 'error', 'danger'] };
/** "change the accent to green": a request to change one COLOUR TOKEN of the brand kit. Returns the token and its new hex, or null (then it is an ordinary request). Applied by the Brand editor path (every frame, one undo step), no model. */
export function tokenRequest(request: string, kit: Record<string, string>): { name: string; value: string } | null {
  const m = /^(?:please )?(?:change|set|make|turn)\s+(?:the )?([a-z]+)(?: colou?r)?\s+(?:to|into|is)?\s*(#[0-9a-f]{6}|#[0-9a-f]{3}|[a-z]+)\s*[.!]?$/i.exec(request.trim()); if (!m) return null;
  const word = m[1]!.toLowerCase(); const aliases = WORDS[word]; if (!aliases) return null; const c = m[2]!.toLowerCase(); const hex = c.startsWith('#') ? (c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c) : HEXES[c]; if (!hex) return null;
  const name = Object.keys(kit).find((k) => aliases.includes(k.replace(/^--/, '').toLowerCase()) && /^#[0-9a-f]{3,8}$/i.test(kit[k]!.trim())); return name ? { name, value: hex } : null;
}

const SCALE_WORDS: Record<string, { aliases: string[]; up: string[]; down: string[] }> = {
  glass: { aliases: ['blur', 'glass'], up: ['thicker', 'frostier', 'blurrier', 'more'], down: ['thinner', 'clearer', 'less'] },
  blur: { aliases: ['blur', 'glass'], up: ['more', 'stronger', 'thicker', 'bigger'], down: ['less', 'weaker', 'thinner', 'smaller'] },
  radius: { aliases: ['rad', 'radius', 'corner'], up: ['bigger', 'larger', 'rounder', 'more'], down: ['smaller', 'sharper', 'less'] },
  corners: { aliases: ['rad', 'radius', 'corner'], up: ['rounder', 'bigger', 'more'], down: ['sharper', 'smaller', 'less'] },
};
/** Non-colour tokens: "make the glass thicker", "reduce the blur", "rounder corners" scale a px token of the kit, and "use Barlow instead of Inter" swaps a font token. Applied as a CUSTOM PROPERTY on the frame root (what Claude's `token` op does), no model. */
export function propTokenRequest(request: string, kit: Record<string, string>): { name: string; value: string } | null {
  const t = request.trim().toLowerCase().replace(/[.!]+$/, '').replace(/\s+/g, ' ');
  const font = /^(?:please )?use ([\w][\w -]{0,30}?) instead of ([\w][\w -]{0,30})$/.exec(t); if (font) { const from = font[2]!.trim(), to = font[1]!.trim().replace(/\b\w/g, (c) => c.toUpperCase()); const name = Object.keys(kit).find((k) => kit[k]!.toLowerCase().includes(from)); return name ? { name, value: `${to}, ${kit[name]!.replace(new RegExp(from, 'i'), to).split(',').slice(1).join(',').trim() || 'sans-serif'}`.replace(/, $/, '') } : null; }
  let m = /^(?:please )?(?:make )?(?:the )?(glass|blur|radius|corners) (\w+)$/.exec(t); let word = '', dir = 0;
  if (m) { word = m[1]!; const sw = SCALE_WORDS[word]!; dir = sw.up.includes(m[2]!) ? 1 : sw.down.includes(m[2]!) ? -1 : 0; }
  else { m = /^(?:please )?(reduce|increase|lower|raise) (?:the )?(glass|blur|radius|corners)$/.exec(t); if (m) { word = m[2]!; dir = m[1] === 'reduce' || m[1] === 'lower' ? -1 : 1; } else { m = /^(rounder|sharper) (corners|radius)$/.exec(t); if (m) { word = m[2]!; dir = m[1] === 'rounder' ? 1 : -1; } } }
  if (!dir || !word) return null; const aliases = SCALE_WORDS[word]!.aliases; const name = Object.keys(kit).find((k) => aliases.includes(k.replace(/^--/, '').toLowerCase()) && /^-?\d+(?:\.\d+)?px$/.test(kit[k]!.trim())); if (!name) return null;
  const cur = parseFloat(kit[name]!); return { name, value: `${Math.round(cur * (dir > 0 ? 1.5 : 0.6) * 100) / 100}px` };
}

const THEMES = { dark: { background: '#0b0b0f', text: '#f5f5f7' }, light: { background: '#f5f5f7', text: '#1c1c1e' } } as const;
/** "turn this into a dark theme" / "make it light": the background and text tokens of the kit change together (one undo step). Needs both tokens in the kit, else it is an ordinary request. */
export function themeRequest(request: string, kit: Record<string, string>): { name: string; value: string }[] | null {
  const m = /^(?:please )?(?:turn|make|switch|change)(?: this| it| the design| the screen| the page| the theme)?(?: (?:in)?to)?(?: a| the)? (dark|light)(?: mode| theme)?[.!]?$/i.exec(request.trim().replace(/\s+/g, ' ')); if (!m) return null; const t = THEMES[m[1]!.toLowerCase() as 'dark' | 'light'];
  const find = (aliases: string[]) => Object.keys(kit).find((k) => aliases.includes(k.replace(/^--/, '').toLowerCase()) && /^#[0-9a-f]{3,8}$/i.test(kit[k]!.trim())); const bg = find(WORDS.background!), tx = find(WORDS.text!);
  return bg && tx ? [{ name: bg, value: t.background }, { name: tx, value: t.text }] : null;
}
