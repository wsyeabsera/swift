/** The bundled sample project (task #1843): three starters (#1833) plus something to show in every lens: a link flow, a motion track, a Critique finding, tokens, a 3D scene. Pure data. */
import type { FrameDef } from '../canvas/fixtures';
import { instantiateTemplate, parseTemplate } from '../template';
import { STARTERS, STARTER_TOKENS } from '../templates/starters';
import { starterScene, type Scene3D } from '../studio3d/scene';
import type { Link } from '../proto';
import type { Timeline } from '../motion';
import { surfaceOf } from '../canvas/frames';
import type { Lens } from './lenses';

export const SAMPLE_NAME = 'Sample';
export type Sample = { name: string; frames: FrameDef[]; brand: Record<string, string>; motion: Timeline; links: Link[]; scene: Scene3D };
const GAP = 160;
/** A tap target far under 44 px on a phone frame: the Critique lens has a real finding (with a one-click fix) the moment the tour gets there. */
const TINY = '<button id="sample-close" style="position:absolute;right:20px;top:60px;width:20px;height:20px;padding:0;border:0;border-radius:10px;font-size:12px;background:var(--c-card);color:var(--c-fg)" aria-label="Close">×</button>';

function build(dir: string): FrameDef[] {
  const s = STARTERS.find((x) => x.dir === `builtin:${dir}`); if (!s) throw new Error(`no starter ${dir}`);
  const t = parseTemplate(s.folder); if (!t.ok) throw new Error(`${dir}: ${t.error}`); const i = instantiateTemplate(t.value); if (!i.ok) throw new Error(`${dir}: ${i.error}`); return i.value.frames;
}
export function buildSample(): Sample {
  let x = 0; const frames: FrameDef[] = [];
  for (const dir of ['landing', 'dashboard', 'mobile-shell']) for (const f of build(dir)) {
    const html = f.id === 'mob' ? f.html.replace(/<\/div>\s*$/, `${TINY}</div>`) : f.html; frames.push({ ...f, html, x, y: 0 }); x += f.w + GAP;
  }
  const motion: Timeline = { duration: 1200, tracks: [
    { frame: 'landing', el: 'landing-headline', prop: 'opacity', keys: [{ t: 0, v: '0', ease: 'expo.out' }, { t: 600, v: '1', ease: 'expo.out' }] },
    { frame: 'landing', el: 'landing-sub', prop: 'opacity', keys: [{ t: 200, v: '0', ease: 'quad.out' }, { t: 900, v: '1', ease: 'quad.out' }] },
    { frame: 'landing', el: 'landing-cta', prop: 'translate', keys: [{ t: 400, v: '0px 24px', ease: 'back.out' }, { t: 1200, v: '0px 0px', ease: 'back.out' }] },
  ] };
  const links: Link[] = [{ frame: 'landing', el: 'landing-cta', to: 'dash' }, { frame: 'landing', el: 'landing-signin', to: 'mob' }];
  return { name: SAMPLE_NAME, frames, brand: { ...STARTER_TOKENS }, motion, links, scene: starterScene() };
}
/** How many things a lens has to show in this project. Zero means the lens would look empty. */
export function lensContent(s: Sample, lens: Lens): number {
  switch (lens) {
    case 'Design': return s.frames.length;
    case 'Prototype': return s.links.length;
    case 'Motion': return s.motion.tracks.length;
    case 'Effects': return s.frames.length; // effects attach to any element
    case '3D': return s.scene.objects.length;
    case 'Critique': return s.frames.filter((f) => surfaceOf(f) === 'phone' && f.html.includes('id="sample-close"')).length;
    case 'Pulse': return 1; // the Claude pool line is always there; history fills as you use the app
    case 'Brand': return Object.keys(s.brand).length;
    case 'Diagram': return 0; // not built in the app yet
  }
}
export const isSampleName = (name: string): boolean => name === SAMPLE_NAME || /^Sample( \d+)?$/.test(name);
export const TOUR_FLAG = 'swift-canvas.tour.v1';
