import { expect, test } from 'vitest';
import { parseProjectFile, projectFileName, serializeProject, MAX_FILE_BYTES } from './projectFile';
import { makeFrames } from './canvas/fixtures';
test('round trip keeps name, frames and brand', () => { const f = makeFrames(5); const r = parseProjectFile(serializeProject('Research Radar', f, { '--ac': '#0a84ff' })); expect(r).toEqual({ ok: true, project: { name: 'Research Radar', frames: f, brand: { '--ac': '#0a84ff' } } }); });
test('refusals say why: junk, wrong version, no name, bad frames, too large', () => {
  const f = makeFrames(2); const base = { swiftCanvas: 1, name: 'x', frames: f, brand: {} };
  const err = (v: unknown) => { const r = parseProjectFile(typeof v === 'string' ? v : JSON.stringify(v)); return r.ok ? 'OK' : r.error; };
  expect(err('nope')).toBe('not JSON'); expect(err({ ...base, swiftCanvas: 2 })).toMatch(/not a Swift Canvas/); expect(err({ ...base, name: '!!!' })).toMatch(/usable name/); expect(err({ ...base, frames: [] })).toMatch(/frames/); expect(err({ ...base, frames: [{ id: 'a' }] })).toMatch(/frames/);
  expect(err(null)).toMatch(/not a Swift Canvas/); expect(err('x'.repeat(MAX_FILE_BYTES + 1))).toBe('file too large');
});
test('brand from a file is filtered like a scan: injection and non-tokens are dropped', () => { const r = parseProjectFile(JSON.stringify({ swiftCanvas: 1, name: 'x', frames: makeFrames(1), brand: { '--ok': '#fff', '--bad': 'red; x:y', color: 'red' } })); expect(r.ok && r.project.brand).toEqual({ '--ok': '#fff' }); });
test('file names are slugged', () => { expect(projectFileName('Research Radar')).toBe('research-radar.swiftcanvas.json'); expect(projectFileName('!!!')).toBe('project.swiftcanvas.json'); });
