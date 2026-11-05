/** The lens tour (task #1843): what each lens does, three key actions and the Claude Code prompt that does the same. Pure data and tiny state helpers, no DOM. */
export const LENSES = ['Design', 'Prototype', 'Motion', 'Effects', '3D', 'Critique', 'Pulse', 'Brand', 'Diagram'] as const;
export type Lens = (typeof LENSES)[number];
export type LensInfo = { line: string; actions: [string, string, string]; prompt: string; /** false: the lens is only a board in the design kit so far; the tour says so instead of pretending */ built: boolean };
export const LENS_INFO: Record<Lens, LensInfo> = {
  Design: { line: 'Edit screens on the canvas: select, move, resize, restyle, or say what you want.', actions: ['Press ⌘K and say "make the headline bigger"', 'Enter selects a screen, arrow keys nudge', 'Frame ▾ exports HTML, React or tokens'], prompt: 'Use the swift-canvas MCP: read_subtree landing, then apply_ops to make #landing-headline 80px.', built: true },
  Prototype: { line: 'Link a button to another screen, then Play to click through the flow.', actions: ['Pick an element, link it to a screen', 'Show hotspots to see every link', 'Play follows the links like a user'], prompt: 'Link #landing-cta to the Dashboard frame, then list the flows.', built: true },
  Motion: { line: 'Keyframe any property over time, scrub it, render it to an MP4.', actions: ['Key here stores the value at the playhead', 'The time slider scrubs; Space plays', 'Render MP4 writes every 1/30 s'], prompt: 'Fade #landing-headline in over 600 ms with expo.out.', built: true },
  Effects: { line: 'Add interaction effects (hover, press, reveal) from presets, with a cost meter.', actions: ['Pick a preset for the selection', 'The meter shows what it costs per frame', 'Suggestions fit the element'], prompt: 'Add a press effect to #landing-cta.', built: true },
  '3D': { line: 'Build a small 3D scene, light it, and drop a still of it into a screen.', actions: ['Add a shape or light', 'Orbit with the mouse or the view presets', 'Insert still puts a render in your design'], prompt: 'Add a torus to the scene and insert a still into the Landing frame.', built: true },
  Critique: { line: 'Check a screen for contrast, clipped text and small tap targets, then fix with one click.', actions: ['Check frame runs the local audit', 'Select jumps to the element', 'Fix applies the one safe change (undoable)'], prompt: 'Run check on the Mobile frame and fix every tap-target finding.', built: true },
  Pulse: { line: 'See how fast and how well Say works on this device, and the Claude pool.', actions: ['History lists your last requests', 'Rows flag slow or failing skills', 'Review skills asks Claude for proposals'], prompt: 'Show the latency of my last ten Says.', built: true },
  Brand: { line: 'The tokens, moodboard and crew behind every screen; edit one token, everything follows.', actions: ['Edit a colour token', 'Export or import tokens.json', 'Add moodboard images to steer Spark'], prompt: 'set_token --accent to #ff8a3d and re-check contrast.', built: true },
  Diagram: { line: 'Architecture and flow diagrams. Today they exist as boards in the design kit; the in-app lens is not built yet.', actions: ['Nothing to click yet', 'Use Design for boxes and arrows meanwhile', 'Tracked in the design boards (DiagramArch, DiagramFlow)'], prompt: 'Draw the request flow as boxes and arrows in a new frame.', built: false },
};
export const nextLens = (l: Lens): Lens | null => LENSES[LENSES.indexOf(l) + 1] ?? null;
export const prevLens = (l: Lens): Lens | null => LENSES[LENSES.indexOf(l) - 1] ?? null;
/** Tour key handling: →/← step, Esc leaves. Typing in a field never steps the tour. */
export type TourKey = { key: string; target?: EventTarget | { tagName?: string; isContentEditable?: boolean } | null; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean };
export function tourAction(e: TourKey): 'next' | 'prev' | 'exit' | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.key === 'Escape') return 'exit';
  const t = (e.target ?? {}) as { tagName?: string; isContentEditable?: boolean }; const tag = t.tagName?.toUpperCase(); if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return null;
  return e.key === 'ArrowRight' ? 'next' : e.key === 'ArrowLeft' ? 'prev' : null;
}
