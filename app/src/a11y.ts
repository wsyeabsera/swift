/** Accessibility helpers (task #1840): reduced motion and the keyboard way to a first selection. */
export const reducedMotion = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Duration for an animated view move: 0 when the user asked for less motion (the move then jumps). */
export const motionMs = (ms: number): number => (reducedMotion() ? 0 : ms);
/** Enter with nothing selected picks the first screen (the canvas has no other keyboard way in). */
export function firstSelection(frames: readonly { id: string; root: string }[]): { frameId: string; el: string } | null { const f = frames[0]; return f ? { frameId: f.id, el: f.root } : null; }
