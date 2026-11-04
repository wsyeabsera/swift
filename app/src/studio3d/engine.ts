// The 3D lens' engine: three.js (WebGPURenderer, which falls back to WebGL2 on machines or browsers without WebGPU) drawing a `Scene3D` document. Loaded lazily (a dynamic import)
// so the app does not pay for three.js until the 3D lens opens. Renders ON DEMAND (after a change), never in a loop. Only the scene CONTENT (objects and lights) is exported to glb:
// the grid and the selection box are helpers.
import { cameraPosition, type Scene3D } from './scene';
export type Engine = {
  backend: 'WebGPU' | 'WebGL';
  setScene(sc: Scene3D, selectedId: string | null): Promise<void>;
  pick(clientX: number, clientY: number): string | null;
  resize(): Promise<void>;
  exportGlb(): Promise<ArrayBuffer>;
  still(width: number, mime: 'image/png' | 'image/jpeg'): Promise<string>;
  /** Pixel under the canvas centre, for tests and the "is it blank" check. */
  centerPixel(): Promise<[number, number, number]>;
  dispose(): void;
};
export async function createEngine(canvas: HTMLCanvasElement): Promise<Engine> {
  const THREE = await import('three/webgpu'); const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true }); await renderer.init(); const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL';
  const scene = new THREE.Scene(); const content = new THREE.Group(); content.name = 'content'; const helpers = new THREE.Group(); scene.add(content, helpers); const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500); const ray = new THREE.Raycaster();
  const grid = new THREE.GridHelper(20, 20, 0x556070, 0x2c3440); (grid.material as { transparent: boolean; opacity: number }).transparent = true; (grid.material as { opacity: number }).opacity = 0.5; helpers.add(grid);
  const disposeGroup = (g: InstanceType<typeof THREE.Group>): void => { for (const c of [...g.children]) { g.remove(c); const m = c as InstanceType<typeof THREE.Mesh>; m.geometry?.dispose(); const mat = m.material as { dispose?: () => void } | undefined; mat?.dispose?.(); } };
  const geometry = (shape: string): InstanceType<typeof THREE.BufferGeometry<import('three/webgpu').NormalBufferAttributes>> => { switch (shape) { case 'sphere': return new THREE.SphereGeometry(0.5, 48, 32); case 'torus': return new THREE.TorusGeometry(0.5, 0.18, 24, 64); case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 48); case 'plane': return new THREE.PlaneGeometry(1, 1); default: return new THREE.BoxGeometry(1, 1, 1); } };
  let selBox: InstanceType<typeof THREE.BoxHelper> | null = null; const fit = (): void => { const w = Math.max(2, canvas.clientWidth), h = Math.max(2, canvas.clientHeight); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const draw = async (): Promise<void> => { renderer.render(scene, camera); }; // after `await renderer.init()` a plain render is enough
  return {
    backend,
    async setScene(sc, selectedId) {
      disposeGroup(content); if (selBox) { helpers.remove(selBox); selBox.dispose(); selBox = null; } scene.background = new THREE.Color(sc.background);
      for (const o of sc.objects) { const mesh = new THREE.Mesh(geometry(o.shape), new THREE.MeshStandardMaterial({ color: o.color, metalness: o.metalness, roughness: o.roughness, side: o.shape === 'plane' ? THREE.DoubleSide : THREE.FrontSide })); mesh.name = o.name; mesh.userData.id = o.id; mesh.position.set(...o.position); mesh.rotation.set(...(o.rotation.map((d) => (d * Math.PI) / 180) as [number, number, number])); mesh.scale.set(...o.scale); content.add(mesh); if (o.id === selectedId) { selBox = new THREE.BoxHelper(mesh, 0xffffff); helpers.add(selBox); } }
      for (const l of sc.lights) { const light = l.kind === 'ambient' ? new THREE.AmbientLight(l.color, l.intensity) : l.kind === 'point' ? new THREE.PointLight(l.color, l.intensity * 20, 0, 2) : new THREE.DirectionalLight(l.color, l.intensity); light.name = l.id; light.userData.id = l.id; light.position.set(...l.position); content.add(light); }
      camera.fov = sc.camera.fov; camera.position.set(...cameraPosition(sc.camera)); camera.lookAt(...sc.camera.target); camera.updateProjectionMatrix(); fit(); await draw();
    },
    pick(clientX, clientY) { const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera); const hit = ray.intersectObjects(content.children.filter((c) => (c as { isMesh?: boolean }).isMesh), false)[0]; return (hit?.object.userData.id as string | undefined) ?? null; },
    async resize() { fit(); await draw(); },
    async exportGlb() { const r = await new GLTFExporter().parseAsync(content, { binary: true }); if (!(r instanceof ArrayBuffer)) throw new Error('the exporter did not return a binary glb'); return r; },
    async still(width, mime) { await draw(); await new Promise((res) => requestAnimationFrame(res)); await draw(); const h = Math.round((canvas.height / canvas.width) * width); const c = document.createElement('canvas'); c.width = width; c.height = h; const g = c.getContext('2d')!; g.drawImage(canvas, 0, 0, width, h); return c.toDataURL(mime, 0.85); },
    async centerPixel() { await draw(); await new Promise((res) => requestAnimationFrame(res)); await draw(); const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(canvas, 0, 0); const d = g.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data; return [d[0]!, d[1]!, d[2]!]; },
    dispose() { disposeGroup(content); renderer.dispose(); },
  };
}
