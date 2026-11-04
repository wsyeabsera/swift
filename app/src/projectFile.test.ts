import { expect, test } from 'vitest';
import { parseProjectFile, projectFileName, serializeProject, MAX_FILE_BYTES } from './projectFile';
import { makeFrames } from './canvas/fixtures';
test('round trip keeps name, frames and brand', () => { const f = makeFrames(5); const r = parseProjectFile(serializeProject('Research Radar', f, { '--ac': '#0a84ff' })); expect(r).toEqual({ ok: true, project: { name: 'Research Radar', frames: f, brand: { '--ac': '#0a84ff' }, log: null, motion: null, links: [] } }); });
test('refusals say why: junk, wrong version, no name, bad frames, too large', () => {
  const f = makeFrames(2); const base = { swiftCanvas: 1, name: 'x', frames: f, brand: {} };
  const err = (v: unknown) => { const r = parseProjectFile(typeof v === 'string' ? v : JSON.stringify(v)); return r.ok ? 'OK' : r.error; };
  expect(err('nope')).toBe('not JSON'); expect(err({ ...base, swiftCanvas: 2 })).toMatch(/not a Swift Canvas/); expect(err({ ...base, name: '!!!' })).toMatch(/usable name/); expect(err({ ...base, frames: [] })).toMatch(/frames/); expect(err({ ...base, frames: [{ id: 'a' }] })).toMatch(/frames/);
  expect(err(null)).toMatch(/not a Swift Canvas/); expect(err('x'.repeat(MAX_FILE_BYTES + 1))).toBe('file too large');
});
test('brand from a file is filtered like a scan: injection and non-tokens are dropped', () => { const r = parseProjectFile(JSON.stringify({ swiftCanvas: 1, name: 'x', frames: makeFrames(1), brand: { '--ok': '#fff', '--bad': 'red; x:y', color: 'red' } })); expect(r.ok && r.project.brand).toEqual({ '--ok': '#fff' }); });
test('file names are slugged', () => { expect(projectFileName('Research Radar')).toBe('research-radar.swiftcanvas.json'); expect(projectFileName('!!!')).toBe('project.swiftcanvas.json'); });

import * as Lg from './oplog';
test('the undo history travels in the project file; a damaged or missing log never blocks opening the frames', () => {
  const fr = { id: 'tv', root: 'tv', title: 'TV', x: 0, y: 0, w: 10, h: 10, html: '<div id="tv"></div>' }; const log = Lg.undo(Lg.push(Lg.push(Lg.emptyLog(), { kind: 'set', frame: 'tv', el: 'a', prop: 'p', before: '1', after: '2' }), { kind: 'rename', frame: 'tv', before: 'x', after: 'y' })).log;
  const r = parseProjectFile(serializeProject('demo', [fr], { '--bg': '#000' }, log)); expect(r.ok && r.project.log).toEqual(log);
  const none = parseProjectFile(serializeProject('demo', [fr], {})); expect(none.ok && none.project.log).toBeNull();
  const bad = JSON.parse(serializeProject('demo', [fr], {}, log)); bad.log.head = 99; const b = parseProjectFile(JSON.stringify(bad)); expect(b.ok).toBe(true); expect(b.ok && b.project.log).toBeNull(); expect(b.ok && b.project.frames).toEqual([fr]);
});
test('motion round-trips with the project; a damaged one is dropped, the frames still open', () => {
  const fr = { id: 'tv', root: 'tv', title: 'TV', x: 0, y: 0, w: 10, h: 10, html: '<div id="tv"></div>' }; const tl = { duration: 1000, tracks: [{ frame: 'tv', el: 'tv', prop: 'opacity', keys: [{ t: 0, v: '0', ease: 'linear' as const }, { t: 500, v: '1', ease: 'expo.out' as const }] }] };
  const ok = parseProjectFile(serializeProject('demo', [fr], {}, undefined, tl)); expect(ok.ok && ok.project.motion).toEqual(tl);
  const none = parseProjectFile(serializeProject('demo', [fr], {})); expect(none.ok && none.project.motion).toBeNull();
  const bad = JSON.parse(serializeProject('demo', [fr], {}, undefined, tl)); bad.motion = { duration: 'x' }; const r = parseProjectFile(JSON.stringify(bad)); expect(r.ok && r.project.motion).toBeNull(); expect(r.ok && r.project.frames).toHaveLength(1);
});
test('prototype links round-trip with the project; junk links are dropped, the frames still open', () => {
  const fr = { id: 'tv', root: 'tv', title: 'TV', x: 0, y: 0, w: 10, h: 10, html: '<div id="tv"></div>' }; const links = [{ frame: 'tv', el: 'clock', to: 'phone-1' }];
  const ok = parseProjectFile(serializeProject('demo', [fr], {}, undefined, undefined, links)); expect(ok.ok && ok.project.links).toEqual(links); const none = parseProjectFile(serializeProject('demo', [fr], {})); expect(none.ok && none.project.links).toEqual([]);
  const bad = JSON.parse(serializeProject('demo', [fr], {}, undefined, undefined, links)); bad.links = [{ frame: 1 }, null, { frame: 'a', el: 'b', to: 'a' }, ...links]; const r = parseProjectFile(JSON.stringify(bad)); expect(r.ok && r.project.links).toEqual(links);
});
