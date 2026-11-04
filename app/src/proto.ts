/** Prototype flows: an element of one frame links to another frame; in Play, clicking it (or anything inside it) goes there. Pure data, stored per project. */
export type Link = { frame: string; el: string; to: string };
export const MAX_LINKS = 200;
export function addLink(links: Link[], l: Link): { ok: true; links: Link[] } | { ok: false; error: string } {
  if (l.frame === l.to) return { ok: false, error: 'a link must go to another frame' }; const rest = links.filter((x) => !(x.frame === l.frame && x.el === l.el)); if (rest.length >= MAX_LINKS) return { ok: false, error: `at most ${MAX_LINKS} links` };
  return { ok: true, links: [...rest, l] };
}
export const removeLink = (links: Link[], l: Link): Link[] => links.filter((x) => !(x.frame === l.frame && x.el === l.el));
/** The link a click lands on: `chain` is the clicked element then its parents, so the innermost linked one wins. */
export function follow(links: Link[], frame: string, chain: string[]): Link | null { for (const el of chain) { const l = links.find((x) => x.frame === frame && x.el === el); if (l) return l; } return null; }
/** Links whose frames still exist (a deleted frame takes its links with it). */
export const pruneLinks = (links: Link[], frameIds: string[]): Link[] => links.filter((l) => frameIds.includes(l.frame) && frameIds.includes(l.to));
export function parseLinks(raw: unknown): Link[] {
  if (!Array.isArray(raw)) return []; const out: Link[] = []; for (const x of raw) { if (out.length >= MAX_LINKS) break; const r = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>; if (typeof r.frame === 'string' && typeof r.el === 'string' && typeof r.to === 'string' && r.frame !== r.to && !out.some((o) => o.frame === r.frame && o.el === r.el)) out.push({ frame: r.frame, el: r.el, to: r.to }); } return out;
}
const KEY = (project: string): string => `swift-canvas.proto.v1.${project}`;
export function loadLinks(project: string): Link[] { try { const raw = localStorage.getItem(KEY(project)); return raw ? parseLinks(JSON.parse(raw)) : []; } catch { return []; } }
export function saveLinks(project: string, links: Link[]): string | null { try { localStorage.setItem(KEY(project), JSON.stringify(links)); return null; } catch (e) { return e instanceof Error ? e.message : 'save failed'; } }
