/** Inline CSS -> Tailwind utility classes, for the React export. Total by construction: a declaration with a direct utility (`position:absolute` -> `absolute`, `font-weight:200` -> `font-extralight`) becomes it,
 *  a length or colour becomes an arbitrary-value utility (`left:115px` -> `left-[115px]`), and anything else becomes an arbitrary PROPERTY (`translate:400px 0px` -> `[translate:400px_0px]`),
 *  so no declaration is ever dropped. Colours equal to a brand token become `var(--token)` references. Tailwind 3.3+ and 4 read all of these forms. Pure. */
export function splitDecls(style: string): [string, string][] {
  const parts: string[] = []; let cur = '', depth = 0, q = ''; for (const ch of style) { if (q) { if (ch === q) q = ''; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '(') depth++; else if (ch === ')') depth--; if (ch === ';' && depth === 0 && !q) { parts.push(cur); cur = ''; } else cur += ch; } parts.push(cur);
  return parts.flatMap((d): [string, string][] => { const k = d.indexOf(':'); if (k < 0) return []; const prop = d.slice(0, k).trim().toLowerCase(); const value = d.slice(k + 1).trim().replace(/\s*!important$/i, ''); return prop && value ? [[prop, value]] : []; });
}
const KEYWORD: Record<string, Record<string, string>> = {
  display: { block: 'block', flex: 'flex', grid: 'grid', inline: 'inline', 'inline-block': 'inline-block', 'inline-flex': 'inline-flex', none: 'hidden' },
  position: { static: 'static', relative: 'relative', absolute: 'absolute', fixed: 'fixed', sticky: 'sticky' },
  overflow: { hidden: 'overflow-hidden', auto: 'overflow-auto', visible: 'overflow-visible', scroll: 'overflow-scroll' },
  'font-style': { italic: 'italic', normal: 'not-italic' }, 'text-transform': { uppercase: 'uppercase', lowercase: 'lowercase', capitalize: 'capitalize' }, 'text-align': { left: 'text-left', center: 'text-center', right: 'text-right', justify: 'text-justify' },
  'white-space': { nowrap: 'whitespace-nowrap', normal: 'whitespace-normal', pre: 'whitespace-pre' }, 'flex-direction': { row: 'flex-row', column: 'flex-col' }, 'flex-wrap': { wrap: 'flex-wrap', nowrap: 'flex-nowrap' },
  'align-items': { center: 'items-center', 'flex-start': 'items-start', 'flex-end': 'items-end', stretch: 'items-stretch', baseline: 'items-baseline' }, 'justify-content': { center: 'justify-center', 'space-between': 'justify-between', 'flex-start': 'justify-start', 'flex-end': 'justify-end', 'space-around': 'justify-around' },
  'pointer-events': { none: 'pointer-events-none', auto: 'pointer-events-auto' },
};
const WEIGHT: Record<string, string> = { '100': 'font-thin', '200': 'font-extralight', '300': 'font-light', '400': 'font-normal', '500': 'font-medium', '600': 'font-semibold', '700': 'font-bold', bold: 'font-bold', normal: 'font-normal', '800': 'font-extrabold', '900': 'font-black' };
const PREFIX: Record<string, string> = { left: 'left', top: 'top', right: 'right', bottom: 'bottom', width: 'w', height: 'h', 'min-width': 'min-w', 'max-width': 'max-w', 'min-height': 'min-h', 'max-height': 'max-h', padding: 'p', 'padding-top': 'pt', 'padding-right': 'pr', 'padding-bottom': 'pb', 'padding-left': 'pl', margin: 'm', 'margin-top': 'mt', 'margin-right': 'mr', 'margin-bottom': 'mb', 'margin-left': 'ml', gap: 'gap', 'border-radius': 'rounded', opacity: 'opacity', 'z-index': 'z', 'letter-spacing': 'tracking', 'line-height': 'leading', 'box-shadow': 'shadow', 'font-size': 'text' };
/** A value as a Tailwind arbitrary-value body: spaces become `_` (a real underscore is escaped), double quotes become single quotes. */
export const arb = (v: string): string => v.replace(/_/g, '\\_').replace(/\s+/g, '_').replace(/"/g, "'");
const norm = (c: string): string => c.trim().toLowerCase().replace(/\s+/g, '').replace(/(^|[^\d])\.(\d)/g, '$10.$2'); // `.08` and `0.08` are the same colour
const isColour = (v: string): boolean => /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\()/i.test(v.trim());
export function styleToClasses(style: string, tokens: Record<string, string> = {}): string {
  const byColour = new Map<string, string>(); for (const [name, v] of Object.entries(tokens)) if (isColour(v) && !byColour.has(norm(v))) byColour.set(norm(v), name);
  const colour = (v: string): string => { const t = byColour.get(norm(v)); return t ? `var(${t})` : v; };
  return splitDecls(style).map(([prop, value]): string => {
    const kw = KEYWORD[prop]?.[value.toLowerCase()]; if (kw) return kw; if (prop === 'font-weight' && WEIGHT[value.toLowerCase()]) return WEIGHT[value.toLowerCase()]!;
    if (prop === 'color') { const c = colour(value); return `text-[${c.startsWith('var(') ? 'color:' : ''}${arb(c)}]`; }
    if (prop === 'background-color') { const c = colour(value); return `bg-[${c.startsWith('var(') ? 'color:' : ''}${arb(c)}]`; }
    const pre = PREFIX[prop]; if (pre) { const hint = prop === 'font-size' && /^var\(/i.test(value) ? 'length:' : ''; return `${pre}-[${hint}${arb(value)}]`; }
    return `[${prop}:${arb(value)}]`; // anything else keeps its exact property
  }).join(' ');
}
