/** The 3D lens' scene as plain data (the document), separate from three.js (the engine that draws it): primitives with transforms and a standard material, lights, an orbit camera, a background.
 *  Pure and strictly validated: stored data and imported files are untrusted, numbers are clamped, nothing is half-loaded. */
export type Vec3 = [number, number, number];
export const SHAPES = ['box', 'sphere', 'torus', 'cylinder', 'plane'] as const; export type Shape = (typeof SHAPES)[number];
export const LIGHTS = ['ambient', 'directional', 'point'] as const; export type LightKind = (typeof LIGHTS)[number];
export type Obj = { id: string; name: string; shape: Shape; position: Vec3; rotation: Vec3; scale: Vec3; color: string; metalness: number; roughness: number }; // rotation in degrees
export type Light = { id: string; kind: LightKind; color: string; intensity: number; position: Vec3 };
export type Cam = { azimuth: number; elevation: number; distance: number; target: Vec3; fov: number }; // degrees; the camera orbits `target`
export type Scene3D = { objects: Obj[]; lights: Light[]; camera: Cam; background: string };
export const LIMITS = { objects: 60, lights: 8, pos: 1000, scale: 100, name: 40 } as const;
const HEX = /^#[0-9a-f]{6}$/i; const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n)); const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const vec = (v: unknown, d: Vec3, lo: number, hi: number): Vec3 => (Array.isArray(v) && v.length === 3 ? ([clamp(num(v[0], d[0]), lo, hi), clamp(num(v[1], d[1]), lo, hi), clamp(num(v[2], d[2]), lo, hi)] as Vec3) : d);
export const DEFAULT_CAMERA: Cam = { azimuth: 35, elevation: 25, distance: 7, target: [0, 0.5, 0], fov: 45 };
export function starterScene(): Scene3D {
  return { background: '#101820', camera: { ...DEFAULT_CAMERA, target: [...DEFAULT_CAMERA.target] as Vec3 }, objects: [
    { id: 'box-1', name: 'Box', shape: 'box', position: [-1.2, 0.5, 0], rotation: [0, 25, 0], scale: [1, 1, 1], color: '#7cf0d0', metalness: 0.2, roughness: 0.45 },
    { id: 'sphere-1', name: 'Sphere', shape: 'sphere', position: [1.2, 0.6, 0], rotation: [0, 0, 0], scale: [1.2, 1.2, 1.2], color: '#9c8cff', metalness: 0.6, roughness: 0.25 },
    { id: 'plane-1', name: 'Floor', shape: 'plane', position: [0, 0, 0], rotation: [-90, 0, 0], scale: [8, 8, 1], color: '#2a3140', metalness: 0, roughness: 0.9 },
  ], lights: [{ id: 'light-1', kind: 'ambient', color: '#ffffff', intensity: 0.6, position: [0, 0, 0] }, { id: 'light-2', kind: 'directional', color: '#ffffff', intensity: 2.2, position: [4, 6, 3] }] };
}
const label = (s: Shape): string => s[0]!.toUpperCase() + s.slice(1);
const nextId = (ids: string[], base: string): string => { let n = 1; while (ids.includes(`${base}-${n}`)) n++; return `${base}-${n}`; };
export function addObject(sc: Scene3D, shape: Shape): { ok: true; scene: Scene3D; id: string } | { ok: false; error: string } {
  if (sc.objects.length >= LIMITS.objects) return { ok: false, error: `at most ${LIMITS.objects} objects` }; const id = nextId(sc.objects.map((o) => o.id), shape); const n = sc.objects.length;
  const o: Obj = { id, name: `${label(shape)} ${sc.objects.filter((x) => x.shape === shape).length + 1}`, shape, position: [((n % 5) - 2) * 1.4, shape === 'plane' ? 0 : 0.5, Math.floor(n / 5) * -1.4], rotation: shape === 'plane' ? [-90, 0, 0] : [0, 0, 0], scale: shape === 'plane' ? [4, 4, 1] : [1, 1, 1], color: '#ff9b6b', metalness: 0.2, roughness: 0.5 };
  return { ok: true, scene: { ...sc, objects: [...sc.objects, o] }, id };
}
export function addLight(sc: Scene3D, kind: LightKind): { ok: true; scene: Scene3D; id: string } | { ok: false; error: string } {
  if (sc.lights.length >= LIMITS.lights) return { ok: false, error: `at most ${LIMITS.lights} lights` }; const id = nextId(sc.lights.map((l) => l.id), 'light');
  return { ok: true, scene: { ...sc, lights: [...sc.lights, { id, kind, color: '#ffffff', intensity: kind === 'ambient' ? 0.5 : 2, position: kind === 'ambient' ? [0, 0, 0] : [3, 5, 3] }] }, id };
}
export type ObjPatch = Partial<Pick<Obj, 'name' | 'position' | 'rotation' | 'scale' | 'color' | 'metalness' | 'roughness'>>;
/** Change one object: values are clamped and a bad colour or name is refused (the scene is returned unchanged with the reason). */
export function updateObject(sc: Scene3D, id: string, p: ObjPatch): { ok: true; scene: Scene3D } | { ok: false; error: string } {
  const o = sc.objects.find((x) => x.id === id); if (!o) return { ok: false, error: `no object ${id}` }; if (p.color !== undefined && !HEX.test(p.color)) return { ok: false, error: 'colour must look like #rrggbb' }; if (p.name !== undefined && (!p.name.trim() || p.name.length > LIMITS.name)) return { ok: false, error: `name must be 1-${LIMITS.name} characters` };
  const next: Obj = { ...o, ...(p.name !== undefined ? { name: p.name.trim() } : {}), ...(p.position ? { position: vec(p.position, o.position, -LIMITS.pos, LIMITS.pos) } : {}), ...(p.rotation ? { rotation: vec(p.rotation, o.rotation, -360, 360) } : {}), ...(p.scale ? { scale: vec(p.scale, o.scale, 0.001, LIMITS.scale) } : {}), ...(p.color !== undefined ? { color: p.color.toLowerCase() } : {}), ...(p.metalness !== undefined ? { metalness: clamp(num(p.metalness, o.metalness), 0, 1) } : {}), ...(p.roughness !== undefined ? { roughness: clamp(num(p.roughness, o.roughness), 0, 1) } : {}) };
  return { ok: true, scene: { ...sc, objects: sc.objects.map((x) => (x.id === id ? next : x)) } };
}
export function updateLight(sc: Scene3D, id: string, p: Partial<Pick<Light, 'color' | 'intensity' | 'position'>>): { ok: true; scene: Scene3D } | { ok: false; error: string } {
  const l = sc.lights.find((x) => x.id === id); if (!l) return { ok: false, error: `no light ${id}` }; if (p.color !== undefined && !HEX.test(p.color)) return { ok: false, error: 'colour must look like #rrggbb' };
  const next: Light = { ...l, ...(p.color !== undefined ? { color: p.color.toLowerCase() } : {}), ...(p.intensity !== undefined ? { intensity: clamp(num(p.intensity, l.intensity), 0, 20) } : {}), ...(p.position ? { position: vec(p.position, l.position, -LIMITS.pos, LIMITS.pos) } : {}) }; return { ok: true, scene: { ...sc, lights: sc.lights.map((x) => (x.id === id ? next : x)) } };
}
export const removeItem = (sc: Scene3D, id: string): Scene3D => ({ ...sc, objects: sc.objects.filter((o) => o.id !== id), lights: sc.lights.filter((l) => l.id !== id) });
export const setCamera = (sc: Scene3D, c: Partial<Cam>): Scene3D => ({ ...sc, camera: { azimuth: num(c.azimuth, sc.camera.azimuth) % 360, elevation: clamp(num(c.elevation, sc.camera.elevation), -85, 85), distance: clamp(num(c.distance, sc.camera.distance), 1, 80), target: c.target ? vec(c.target, sc.camera.target, -LIMITS.pos, LIMITS.pos) : sc.camera.target, fov: clamp(num(c.fov, sc.camera.fov), 15, 100) } });
/** Where the orbit camera sits, from azimuth/elevation (degrees) and distance around its target. */
export function cameraPosition(c: Cam): Vec3 { const az = (c.azimuth * Math.PI) / 180, el = (c.elevation * Math.PI) / 180; return [c.target[0] + c.distance * Math.cos(el) * Math.sin(az), c.target[1] + c.distance * Math.sin(el), c.target[2] + c.distance * Math.cos(el) * Math.cos(az)]; }
/** Untrusted JSON -> a valid scene (bad objects and lights dropped one by one, never the whole scene); null when it is not a scene at all. */
export function parseScene(raw: unknown): Scene3D | null {
  if (typeof raw !== 'object' || raw === null) return null; const o = raw as Record<string, unknown>; if (!Array.isArray(o.objects) || !Array.isArray(o.lights)) return null; const ids = new Set<string>();
  const objects: Obj[] = []; for (const x of o.objects) { if (objects.length >= LIMITS.objects) break; const r = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>; if (typeof r.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(r.id) || ids.has(r.id) || !(SHAPES as readonly string[]).includes(r.shape as string) || typeof r.color !== 'string' || !HEX.test(r.color)) continue; ids.add(r.id);
    objects.push({ id: r.id, name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, LIMITS.name) : r.id, shape: r.shape as Shape, position: vec(r.position, [0, 0, 0], -LIMITS.pos, LIMITS.pos), rotation: vec(r.rotation, [0, 0, 0], -360, 360), scale: vec(r.scale, [1, 1, 1], 0.001, LIMITS.scale), color: r.color.toLowerCase(), metalness: clamp(num(r.metalness, 0.2), 0, 1), roughness: clamp(num(r.roughness, 0.5), 0, 1) }); }
  const lights: Light[] = []; for (const x of o.lights) { if (lights.length >= LIMITS.lights) break; const r = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>; if (typeof r.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(r.id) || ids.has(r.id) || !(LIGHTS as readonly string[]).includes(r.kind as string) || typeof r.color !== 'string' || !HEX.test(r.color)) continue; ids.add(r.id); lights.push({ id: r.id, kind: r.kind as LightKind, color: r.color.toLowerCase(), intensity: clamp(num(r.intensity, 1), 0, 20), position: vec(r.position, [0, 5, 0], -LIMITS.pos, LIMITS.pos) }); }
  const cam = (typeof o.camera === 'object' && o.camera !== null ? o.camera : {}) as Record<string, unknown>; const camera = setCamera({ objects: [], lights: [], background: '', camera: DEFAULT_CAMERA }, { azimuth: num(cam.azimuth, DEFAULT_CAMERA.azimuth), elevation: num(cam.elevation, DEFAULT_CAMERA.elevation), distance: num(cam.distance, DEFAULT_CAMERA.distance), fov: num(cam.fov, DEFAULT_CAMERA.fov), target: vec(cam.target, DEFAULT_CAMERA.target, -LIMITS.pos, LIMITS.pos) }).camera;
  return { objects, lights, camera, background: typeof o.background === 'string' && HEX.test(o.background) ? o.background.toLowerCase() : '#101820' };
}
const KEY = (project: string): string => `swift-canvas.scene3d.v1.${project}`;
export function loadScene(project: string): Scene3D { try { const raw = localStorage.getItem(KEY(project)); return (raw ? parseScene(JSON.parse(raw)) : null) ?? starterScene(); } catch { return starterScene(); } }
export function saveScene(project: string, sc: Scene3D): string | null { try { localStorage.setItem(KEY(project), JSON.stringify(sc)); return null; } catch (e) { return e instanceof Error ? e.message : 'save failed'; } }
