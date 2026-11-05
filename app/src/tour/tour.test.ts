import { expect, test } from 'vitest';
import { loadDoc, saveDoc } from '../doc';
import { parseLinks } from '../proto';
import { parseScene } from '../studio3d/scene';
import { auditFacts } from '../canvas/audit';
import { surfaceOf } from '../canvas/frames';
import { sample as motionSample } from '../motion';
import { toBrandTokens } from '../brand';
import { unsafeReason } from '../template';
import { LENSES, LENS_INFO, nextLens, prevLens, tourAction } from './lenses';
import { buildSample, isSampleName, lensContent } from './sample';

const s = buildSample();
test('every lens has a line, three actions and a Claude Code prompt', () => {
  expect(Object.keys(LENS_INFO).sort()).toEqual([...LENSES].sort());
  for (const l of LENSES) { const i = LENS_INFO[l]; expect(i.line.length).toBeGreaterThan(10); expect(i.actions).toHaveLength(3); expect(i.prompt.length).toBeGreaterThan(10); }
});
test('the sample is valid project data that the app loaders accept as is', () => {
  const mem = new Map<string, string>(); const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }; expect(saveDoc(s.frames, store, 'sample')).toBeNull(); expect(loadDoc(store, 'sample')).toEqual(s.frames);
  expect(parseLinks(s.links)).toEqual(s.links); expect(parseScene(JSON.parse(JSON.stringify(s.scene)))?.objects.length).toBeGreaterThan(0);
  expect(Object.keys(toBrandTokens(Object.entries(s.brand).map(([name, value]) => ({ name, value }))))).toHaveLength(Object.keys(s.brand).length);
  for (const f of s.frames) { expect(unsafeReason(f.html)).toBeNull(); expect(f.html).not.toMatch(/\{\{/); }
  expect(new Set(s.frames.map((f) => f.id)).size).toBe(s.frames.length);
});
test('links, motion tracks and the finding point at elements that exist', () => {
  const has = (frame: string, el: string): boolean => (s.frames.find((f) => f.id === frame)?.html ?? '').includes(`id="${el}"`);
  for (const l of s.links) { expect(has(l.frame, l.el), `${l.frame}/${l.el}`).toBe(true); expect(s.frames.some((f) => f.id === l.to)).toBe(true); }
  for (const t of s.motion.tracks) expect(has(t.frame, t.el), `${t.frame}/${t.el}`).toBe(true);
  expect(motionSample(s.motion, 300).length).toBeGreaterThan(0);
});
test('every built lens has something to show, and Diagram is honest that it has not', () => {
  for (const l of LENSES) { if (LENS_INFO[l].built) expect(lensContent(s, l), l).toBeGreaterThan(0); else expect(lensContent(s, l)).toBe(0); }
  expect(LENS_INFO.Diagram.line).toMatch(/not built/);
});
test('the Critique lens finds the small tap target in the phone frame', () => {
  const f = s.frames.find((x) => x.id === 'mob')!; expect(surfaceOf(f)).toBe('phone');
  const found = auditFacts({ w: f.w, h: f.h, nodes: [{ id: 'sample-close', tag: 'button', text: '×', x: 350, y: 60, w: 20, h: 20, fs: 12, interactive: true, clipX: false, clipY: false }] } as never, 'phone');
  expect(found.some((x) => x.kind === 'tap' && x.fix)).toBe(true);
});
test('tour order walks all lenses forward and back', () => {
  let l = LENSES[0] as (typeof LENSES)[number]; const seen = [l]; for (let n = nextLens(l); n; n = nextLens(n)) seen.push(n); expect(seen).toEqual([...LENSES]);
  expect(prevLens('Design')).toBeNull(); expect(nextLens('Diagram')).toBeNull(); expect(prevLens('Prototype')).toBe('Design'); l = 'Brand'; expect(nextLens(l)).toBe('Diagram');
});
test('tour keys: arrows step, Esc leaves, typing in a field and modifiers do nothing', () => {
  expect(tourAction({ key: 'ArrowRight' })).toBe('next'); expect(tourAction({ key: 'ArrowLeft' })).toBe('prev'); expect(tourAction({ key: 'Escape' })).toBe('exit');
  expect(tourAction({ key: 'ArrowRight', target: { tagName: 'input' } })).toBeNull(); expect(tourAction({ key: 'ArrowLeft', target: { tagName: 'SELECT' } })).toBeNull(); expect(tourAction({ key: 'ArrowRight', target: { tagName: 'DIV', isContentEditable: true } })).toBeNull();
  expect(tourAction({ key: 'ArrowRight', metaKey: true })).toBeNull(); expect(tourAction({ key: 'a' })).toBeNull();
  expect(tourAction({ key: 'ArrowRight', target: { tagName: 'BUTTON' } })).toBe('next');
});
test('sample names', () => { expect(isSampleName('Sample')).toBe(true); expect(isSampleName('Sample 2')).toBe(true); expect(isSampleName('Sampler')).toBe(false); });
