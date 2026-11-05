/** Entry points (task #1844): the toolbar popup, the side panel and a new tab all open the app with a URL hash that says where to land. Pure parsing, no DOM. */
export type Entry = { project?: string; lens?: string; say?: boolean };
/** `#project=<id>&lens=Motion&say=1` (or `lens=3`, the number on the lens bar) -> where to land. Unknown keys and bad values are ignored. */
export function parseEntry(hash: string, lenses: readonly string[]): Entry {
  const p = new URLSearchParams(hash.replace(/^#/, '')); const out: Entry = {};
  const project = p.get('project'); if (project && /^[a-z0-9][a-z0-9-]{0,39}$/.test(project)) out.project = project;
  const l = p.get('lens'); if (l) { const n = /^[1-9]$/.test(l) ? lenses[Number(l) - 1] : lenses.find((x) => x.toLowerCase() === l.toLowerCase()); if (n) out.lens = n; }
  if (p.get('say') === '1') out.say = true; return out;
}
/** The lens for a bare digit key 1..9 (no modifiers) or null: 1 = first lens on the bar. */
export function lensForKey(e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }, lenses: readonly string[]): string | null {
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || !/^[1-9]$/.test(e.key)) return null; return lenses[Number(e.key) - 1] ?? null;
}
