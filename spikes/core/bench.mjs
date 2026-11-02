import fs from 'node:fs'; import { performance } from 'node:perf_hooks';
const N = 5000, M = 64, REPS = 20000;
const tokens = Uint32Array.from({ length: N }, (_, i) => (i * 7) % M), map = Uint32Array.from({ length: M }, (_, i) => 0xff000000 + i * 99991);
function tsRetheme(t, m, o) { for (let i = 0; i < t.length; i++) o[i] = m[t[i]]; }
const bench = (f) => { for (let i = 0; i < 2000; i++) f(); const t = performance.now(); for (let i = 0; i < REPS; i++) f(); return (performance.now() - t) / REPS * 1000; }; // microseconds per call
const outTs = new Uint32Array(N); const usTs = bench(() => tsRetheme(tokens, map, outTs));
const { instance } = await WebAssembly.instantiate(fs.readFileSync('target/wasm32-unknown-unknown/release/spike_core.wasm'));
const w = instance.exports; const mem = () => new Uint32Array(w.memory.buffer);
const pT = w.alloc(N), pM = w.alloc(M), pO = w.alloc(N);
// (a) data already in wasm memory (best case), (b) copy in + copy out every call (marshalling)
mem().set(tokens, pT / 4); mem().set(map, pM / 4);
const usWasmResident = bench(() => w.retheme_raw(pT, N, pM, M, pO));
const outW = new Uint32Array(N);
const usWasmCopy = bench(() => { const u = mem(); u.set(tokens, pT / 4); w.retheme_raw(pT, N, pM, M, pO); outW.set(mem().subarray(pO / 4, pO / 4 + N)); });
const ok = outW.every((v, i) => v === outTs[i]);
console.log(JSON.stringify({ N, outputsMatch: ok, usPerCall: { ts: +usTs.toFixed(2), wasmResident: +usWasmResident.toFixed(2), wasmWithCopies: +usWasmCopy.toFixed(2) } }));
