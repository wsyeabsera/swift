// Fill a list or table frame from rows of repo data (#1837). The helper reads and caps the file (helper/src/data.rs); this turns the rows into canvas edits.
// The container's FIRST child is the row template: its text elements (leaves with text, in document order) take the columns in order. No DOM needed: text is swapped by element id in the template's HTML.
import type { CanvasApi } from './canvas/Canvas';
export const MAX_FILL_ROWS = 200; const MAX_ROW_HTML = 6000; const MAX_CELL = 200;
export type FillTable = { columns: string[]; rows: string[][] };
export type FillPlan = { container: string; remove: string[]; rows: string[]; mapped: string[]; unmapped: number };
type TNode = { id: string; parent: string | null; tag: string; text: string };
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const base = (id: string): string => id.replace(/-r\d+$/, '');

export function parseTable(args: Record<string, unknown>): FillTable {
  const { columns, rows } = args; const isS = (v: unknown): v is string => typeof v === 'string';
  if (!Array.isArray(columns) || !columns.every(isS) || columns.length === 0 || columns.length > 20) throw new Error('columns must be 1-20 strings');
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('no rows to fill'); if (rows.length > MAX_FILL_ROWS) throw new Error(`too many rows (max ${MAX_FILL_ROWS})`);
  const out = rows.map((r, i) => { if (!Array.isArray(r) || !r.every(isS)) throw new Error(`row ${i} must be an array of strings`); return r.map((c) => c.slice(0, MAX_CELL)); });
  return { columns, rows: out };
}

/** The container to fill: a `table` fills its tbody when it has one. */
export function containerOf(nodes: TNode[], el: string): string {
  const n = nodes.find((x) => x.id === el); if (!n) throw new Error(`unknown element ${el}`);
  if (n.tag === 'table') { const body = nodes.find((x) => x.parent === el && x.tag === 'tbody'); if (body) return body.id; }
  return el;
}
/** Build the plan: the template row's HTML once per data row (ids suffixed -r<i> so a refill finds and replaces them), and the old rows to remove. */
export function planFill(nodes: TNode[], container: string, templateHtml: string, t: FillTable): FillPlan {
  const kids = nodes.filter((n) => n.parent === container); if (kids.length === 0) throw new Error(`${container} has no child to use as the row template: add one example row first`);
  const desc = (id: string): TNode[] => nodes.filter((n) => n.parent === id).flatMap((n) => [n, ...desc(n.id)]);
  const leaves = desc(kids[0]!.id).filter((n) => n.text.trim() !== ''); // text leaves (the tree only reports text for elements without child elements)
  if (leaves.length === 0) throw new Error(`the template row ${kids[0]!.id} has no text element to fill`);
  const ids = [kids[0]!.id, ...desc(kids[0]!.id).map((n) => n.id)];
  const rows = t.rows.map((cells, i) => {
    let h = templateHtml;
    leaves.forEach((leaf, k) => { if (k >= cells.length) return; const re = new RegExp(`(<([a-zA-Z][\\w-]*)\\b[^>]*\\bid="${escRe(leaf.id)}"[^>]*>)[^<]*(</\\2>)`); h = h.replace(re, (_m, open: string, _tag: string, close: string) => open + esc(cells[k]!) + close); });
    for (const id of ids) h = h.replace(new RegExp(`\\bid="${escRe(id)}"`, 'g'), `id="${base(id)}-r${i}"`);
    if (h.length > MAX_ROW_HTML) throw new Error(`row ${i} is too large (${h.length} chars)`); return h;
  });
  return { container, remove: kids.map((k) => k.id), rows, mapped: t.columns.slice(0, leaves.length), unmapped: Math.max(0, t.columns.length - leaves.length) };
}

/** Apply the plan as one all-or-nothing batch; the caller records the undo step. */
export async function applyFill(api: CanvasApi, frame: string, plan: FillPlan): Promise<void> {
  for (const id of plan.remove) if (!(await api.remove(frame, id))) throw new Error(`could not remove ${id}`);
  for (const [i, h] of plan.rows.entries()) if (!(await api.add(frame, plan.container, h))) throw new Error(`could not add row ${i}`);
}
