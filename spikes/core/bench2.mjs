import fs from 'node:fs'; import { performance } from 'node:perf_hooks';
const N = 20000, REPS = 3000; const file = process.argv[2];
let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
const rects = new Float32Array(N * 4); for (let i = 0; i < N; i++) { rects[i * 4] = rnd() * 9000; rects[i * 4 + 1] = rnd() * 6000; rects[i * 4 + 2] = 20 + rnd() * 400; rects[i * 4 + 3] = 20 + rnd() * 300; }
const A = Uint32Array.from({ length: N * 4 }, (_, i) => (i * 2654435761) >>> 0); const B = A.slice(); for (let i = 0; i < N * 4; i += 20) B[i] ^= 1;
const tsHit = (r, px, py) => { let f = -1; for (let i = 0; i < N; i++) { const o = i * 4; if (px >= r[o] && px < r[o] + r[o + 2] && py >= r[o + 1] && py < r[o + 1] + r[o + 3]) f = i; } return f; };
const tsVis = (r, vx, vy, vw, vh) => { let c = 0; for (let i = 0; i < N; i++) { const o = i * 4; if (r[o] < vx + vw && r[o] + r[o + 2] > vx && r[o + 1] < vy + vh && r[o + 1] + r[o + 3] > vy) c++; } return c; };
const tsDiff = (a, b) => { let c = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) c++; return c; };
const bench = (f) => { for (let i = 0; i < 300; i++) f(i); const t = performance.now(); for (let i = 0; i < REPS; i++) f(i); return +((performance.now() - t) / REPS * 1000).toFixed(1); };
const { instance } = await WebAssembly.instantiate(fs.readFileSync(file)); const w = instance.exports;
const pR = w.alloc_f32(N * 4), pA = w.alloc(N * 4), pB = w.alloc(N * 4);
new Float32Array(w.memory.buffer).set(rects, pR / 4); new Uint32Array(w.memory.buffer).set(A, pA / 4); new Uint32Array(w.memory.buffer).set(B, pB / 4);
const out = { file: file.split('/').slice(-3).join('/'), N, usPerCall: {
  hit_ts: bench(i => tsHit(rects, (i * 37) % 9000, (i * 53) % 6000)), hit_wasm: bench(i => w.hit_raw(pR, N, (i * 37) % 9000, (i * 53) % 6000)),
  cull_ts: bench(i => tsVis(rects, (i * 11) % 7000, 500, 1440, 900)), cull_wasm: bench(i => w.visible_raw(pR, N, (i * 11) % 7000, 500, 1440, 900)),
  diff_ts: bench(() => tsDiff(A, B)), diff_wasm: bench(() => w.diff_raw(pA, pB, N)) },
  check: { hit: tsHit(rects, 4500, 3000) === w.hit_raw(pR, N, 4500, 3000), cull: tsVis(rects, 100, 500, 1440, 900) === w.visible_raw(pR, N, 100, 500, 1440, 900), diff: tsDiff(A, B) === w.diff_raw(pA, pB, N) } };
console.log(JSON.stringify(out));
