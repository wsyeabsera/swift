import type { FrameDef } from './fixtures';
/** The frame a Spark take or a duplicate was made from: `tv-t3` -> `tv`, `tv-d2` -> `tv`; a plain frame has none. */
export const originalId = (id: string): string | null => { const m = /^(.+)-[td]\d+$/.exec(id); return m ? m[1]! : null; };
/** Frames to show side by side for "Compare with original": the selected frame and its original, or null when there is nothing to compare. */
export function compareSet(frames: FrameDef[], id: string): string[] | null {
  const o = originalId(id); if (!o || !frames.some((f) => f.id === o) || !frames.some((f) => f.id === id)) return null; return [o, id];
}
