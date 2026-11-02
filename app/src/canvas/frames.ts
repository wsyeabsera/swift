import type { FrameDef } from './fixtures';
/** Duplicate: a copy of `base` with its current HTML, placed to the right of everything so it never lands on another frame. */
export function duplicateFrame(frames: FrameDef[], base: FrameDef, id: string, html: string): FrameDef {
  const right = frames.reduce((m, f) => Math.max(m, f.x + f.w), base.x + base.w);
  return { id, root: base.root, title: `${base.title} copy`, x: right + 140, y: base.y, w: base.w, h: base.h, html };
}
/** `<id>-d<n>` with the smallest free n (a duplicate of a duplicate keeps the original's id as stem). */
export function duplicateId(frames: FrameDef[], baseId: string): string {
  const stem = baseId.replace(/-d\d+$/, ''); const used = new Set(frames.map((f) => f.id)); let n = 1; while (used.has(`${stem}-d${n}`)) n++; return `${stem}-d${n}`;
}
/** Rename: trimmed, capped at 60 chars; an empty name keeps the old one. Returns the same array when nothing changes. */
export function renameFrame(frames: FrameDef[], id: string, title: string): FrameDef[] {
  const t = title.trim().slice(0, 60); const f = frames.find((x) => x.id === id); if (!f || !t || t === f.title) return frames; return frames.map((x) => (x.id === id ? { ...x, title: t } : x));
}
