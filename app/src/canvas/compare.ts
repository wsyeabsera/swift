import type { FrameDef } from './fixtures';
/** The frame a Spark take or a duplicate was made from: `tv-t3` -> `tv`, `tv-d2` -> `tv`; a plain frame has none. */
export const originalId = (id: string): string | null => { const m = /^(.+)-[td]\d+$/.exec(id); return m ? m[1]! : null; };
/** Frames to show side by side for "Compare with original": the selected frame and its original, or null when there is nothing to compare. */
export function compareSet(frames: FrameDef[], id: string): string[] | null {
  const o = originalId(id); if (!o || !frames.some((f) => f.id === o) || !frames.some((f) => f.id === id)) return null; return [o, id];
}

import type { ElSig } from './bridge';
export type Change = { el: string; kind: 'changed' | 'added' | 'removed'; props: string[] }; // props = CSS properties whose value differs ('text' for own text)
const decl = (style: string): Map<string, string> => new Map(style.split(';').map((d) => { const i = d.indexOf(':'); return i < 0 ? ['', ''] as const : [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()] as const; }).filter(([k]) => k));
/** What differs between two copies of a design, by element id: the CSS properties and text that changed, and elements only one side has. Same ids = same element (takes and copies are clones). */
export function diffSigs(a: Record<string, ElSig>, b: Record<string, ElSig>): Change[] {
  const out: Change[] = [];
  for (const [el, x] of Object.entries(a)) { const y = b[el]; if (!y) { out.push({ el, kind: 'removed', props: [] }); continue; } const da = decl(x.style), db = decl(y.style); const props = [...new Set([...da.keys(), ...db.keys()])].filter((k) => da.get(k) !== db.get(k)); if (x.text !== y.text) props.push('text'); if (props.length) out.push({ el, kind: 'changed', props }); }
  for (const el of Object.keys(b)) if (!(el in a)) out.push({ el, kind: 'added', props: [] });
  return out;
}
export type MixEdit = { el: string; prop: string; value: string } | { el: string; text: string };
/** Mix two takes of the same original, no model: start from `a` and add what `b` changed that `a` left alone. Where both changed the same thing, `a` wins and it is counted. Elements `b` added or removed are not mixed (counted as skipped). */
export function mixEdits(orig: Record<string, ElSig>, a: Record<string, ElSig>, b: Record<string, ElSig>): { edits: MixEdit[]; conflicts: number; skipped: number } {
  const edits: MixEdit[] = []; let conflicts = 0, skipped = 0;
  for (const [el, o] of Object.entries(orig)) {
    const x = a[el], y = b[el]; if (!y || !x) { if (!y) skipped++; continue; } const do_ = decl(o.style), da = decl(x.style), db = decl(y.style);
    for (const k of new Set([...do_.keys(), ...db.keys()])) { if (db.get(k) === do_.get(k)) continue; if (da.get(k) !== do_.get(k)) { if (da.get(k) !== db.get(k)) conflicts++; continue; } edits.push({ el, prop: k, value: db.get(k) ?? '' }); }
    if (y.text !== o.text) { if (x.text !== o.text) { if (x.text !== y.text) conflicts++; } else edits.push({ el, text: y.text }); }
  }
  for (const el of Object.keys(b)) if (!(el in orig)) skipped++;
  return { edits, conflicts, skipped };
}
