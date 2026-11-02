/** Say request history (↑/↓ in the input), newest last, deduplicated against the previous entry, capped. */
export const MAX_HISTORY = 50;
export const pushHistory = (h: string[], text: string): string[] => { const t = text.trim(); if (!t || h[h.length - 1] === t) return h; return [...h, t].slice(-MAX_HISTORY); };
/** `pos` = index into h, or h.length for "the draft". Returns the new position and the text to show (the draft when back at the end). */
export function step(h: string[], pos: number, dir: -1 | 1, draft: string): { pos: number; text: string } {
  const p = Math.min(h.length, Math.max(0, pos + dir)); return { pos: p, text: p >= h.length ? draft : h[p]! };
}
