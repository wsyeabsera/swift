import { expect, test } from 'vitest';
import { MATERIALS, addLight, addObject, cameraPosition, DEFAULT_CAMERA, LIMITS, parseScene, removeItem, setCamera, starterScene, updateLight, updateObject } from './scene';
test('the starter scene is valid and survives its own parser', () => { const s = starterScene(); expect(s.objects).toHaveLength(3); expect(s.lights).toHaveLength(2); expect(parseScene(JSON.parse(JSON.stringify(s)))).toEqual(s); });
test('adding objects gives unique ids, readable names, and stops at the limit', () => {
  let s = starterScene(); const a = addObject(s, 'box'); if (!a.ok) throw new Error(a.error); expect(a.id).toBe('box-2'); expect(a.scene.objects.at(-1)!.name).toBe('Box 2'); s = a.scene; const t = addObject(s, 'torus'); expect(t.ok && t.id).toBe('torus-1');
  let big = starterScene(); while (big.objects.length < LIMITS.objects) { const r = addObject(big, 'sphere'); if (!r.ok) throw new Error('early'); big = r.scene; } expect(addObject(big, 'box')).toMatchObject({ ok: false, error: expect.stringMatching(/at most 60/) });
});
test('updateObject clamps numbers, lowercases colours and refuses bad colours and names', () => {
  const s = starterScene(); const r = updateObject(s, 'box-1', { position: [5000, 0, -5000], scale: [0, 500, 1], metalness: 7, roughness: -1, color: '#FF00AA' }); if (!r.ok) throw new Error(r.error); const o = r.scene.objects[0]!;
  expect(o.position).toEqual([1000, 0, -1000]); expect(o.scale).toEqual([0.001, 100, 1]); expect([o.metalness, o.roughness, o.color]).toEqual([1, 0, '#ff00aa']);
  expect(updateObject(s, 'box-1', { color: 'red' })).toMatchObject({ ok: false }); expect(updateObject(s, 'box-1', { name: '  ' })).toMatchObject({ ok: false }); expect(updateObject(s, 'nope', {})).toMatchObject({ ok: false }); expect(s.objects[0]!.color).toBe('#7cf0d0'); // the input is untouched
});
test('lights: add, update (intensity clamped), the limit', () => {
  let s = starterScene(); const a = addLight(s, 'point'); if (!a.ok) throw new Error(a.error); expect(a.id).toBe('light-3'); const u = updateLight(a.scene, a.id, { intensity: 99, color: '#aabbcc' }); expect(u.ok && u.scene.lights.at(-1)).toMatchObject({ intensity: 20, color: '#aabbcc' }); expect(updateLight(s, 'light-1', { color: 'x' })).toMatchObject({ ok: false });
  for (let i = 0; i < 8; i++) { const r = addLight(s, 'point'); if (r.ok) s = r.scene; } expect(addLight(s, 'point')).toMatchObject({ ok: false });
});
test('removeItem removes an object or a light by id', () => { const s = removeItem(removeItem(starterScene(), 'box-1'), 'light-2'); expect(s.objects.map((o) => o.id)).toEqual(['sphere-1', 'plane-1']); expect(s.lights.map((l) => l.id)).toEqual(['light-1']); });
test('the camera orbits its target: clamped angles and distance, positions on the sphere', () => {
  const c = setCamera(starterScene(), { elevation: 200, distance: 0, fov: 500, azimuth: 400 }).camera; expect([c.elevation, c.distance, c.fov, c.azimuth]).toEqual([85, 1, 100, 40]);
  const p = cameraPosition({ ...DEFAULT_CAMERA, azimuth: 0, elevation: 0, distance: 10, target: [1, 2, 3] }); expect(p[0]).toBeCloseTo(1); expect(p[1]).toBeCloseTo(2); expect(p[2]).toBeCloseTo(13); const q = cameraPosition({ ...DEFAULT_CAMERA, azimuth: 90, elevation: 0, distance: 4, target: [0, 0, 0] }); expect(q[0]).toBeCloseTo(4); expect(q[2]).toBeCloseTo(0, 5);
});
test('parseScene keeps what is valid and drops the rest: junk objects, duplicate ids, bad colours; garbage is null', () => {
  expect(parseScene(null)).toBeNull(); expect(parseScene({})).toBeNull(); expect(parseScene({ objects: 1, lights: [] })).toBeNull();
  const s = parseScene({ background: 'nope', objects: [{ id: 'a', shape: 'box', color: '#ABCDEF', position: [1, 2, 3], scale: [0, 0, 0] }, { id: 'a', shape: 'sphere', color: '#000000' }, { id: 'b', shape: 'cone', color: '#000000' }, { id: 'c', shape: 'box', color: 'red' }, 5, { id: 'Bad Id', shape: 'box', color: '#000000' }], lights: [{ id: 'l', kind: 'point', color: '#ffffff', intensity: 99 }, { id: 'l', kind: 'point', color: '#ffffff' }, { id: 'a', kind: 'ambient', color: '#ffffff' }, { id: 'z', kind: 'laser', color: '#ffffff' }], camera: { distance: 1e9, elevation: -9e9 } })!;
  expect(s.objects.map((o) => o.id)).toEqual(['a']); expect(s.objects[0]).toMatchObject({ color: '#abcdef', scale: [0.001, 0.001, 0.001], name: 'a' }); expect(s.lights.map((l) => [l.id, l.intensity])).toEqual([['l', 20]]); expect(s.background).toBe('#101820'); expect(s.camera).toMatchObject({ distance: 80, elevation: -85 });
});

test('camera presets move only the viewpoint and stay within limits', async () => {
  const m = await import('./scene'); const base = m.starterScene();
  for (const p of Object.keys(m.CAMERA_PRESETS) as (keyof typeof m.CAMERA_PRESETS)[]) { const r = m.applyPreset(base, p); expect(r.camera.fov).toBe(base.camera.fov); expect(r.camera.target).toEqual(base.camera.target); expect(r.camera.elevation).toBeLessThanOrEqual(85); expect(r.camera.elevation).toBeGreaterThanOrEqual(-85); expect(r.camera.azimuth).toBe(m.CAMERA_PRESETS[p].azimuth); expect(r.camera.distance).toBe(m.CAMERA_PRESETS[p].distance); }
});

test('material swatches are valid patches: every one applies without error and sets exactly its values', () => {
  const base = starterScene(); const id = base.objects[0]!.id;
  for (const [name, m] of Object.entries(MATERIALS)) { const r = updateObject(base, id, m); expect(r.ok, name).toBe(true); if (r.ok) expect(r.scene.objects.find((o) => o.id === id)).toMatchObject(m); }
});
