/** Suggestion chips for the selected element: each is a request the local tier answers instantly (no Claude). Chosen from what the element can actually do. */
export type Suggestion = { label: string; text: string };
export type SuggestProps = { 'font-size'?: string; 'font-weight'?: string; opacity?: string };
const isColor = (v: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
export function suggestions(p: SuggestProps, brand: Record<string, string>, max = 6): Suggestion[] {
  const out: Suggestion[] = []; const fs = /^\d+(\.\d+)?px$/.test(p['font-size'] ?? '') ? parseFloat(p['font-size']!) : 0;
  if (fs > 0) out.push({ label: 'Bigger', text: 'bigger' }, { label: 'Smaller', text: 'smaller' });
  if (fs > 0 && Number(p['font-weight'] ?? 400) < 600) out.push({ label: 'Bold', text: 'bold' });
  out.push(Number(p.opacity ?? 1) === 0 ? { label: 'Show', text: 'show' } : { label: 'Hide', text: 'hide' });
  for (const [name, v] of Object.entries(brand)) { if (out.length >= max) break; if (isColor(v) && fs > 0) out.push({ label: `Text ${name}`, text: `color ${v.trim()}` }); }
  return out.slice(0, max);
}
