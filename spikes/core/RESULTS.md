# Spike #1708: Rust vs TypeScript (partial, 2026-11-02)

Rust 1.93, wasm32-unknown-unknown, no bindgen (raw pointers), Node 24, M2 Pro. Op: re-theme 5000 nodes (token id -> colour via a 64-entry map),
`node bench.mjs`.

| Variant | Time per call (5000 nodes) |
|---|---|
| TypeScript, typed arrays | 2.48 us |
| WASM, data already in WASM memory | 2.68 us |
| WASM, copy in + copy out each call | 3.30 us |

Outputs match. **WASM gives no speed-up on this kind of op**: it is memory-bound and tiny, and V8 already compiles the loop well. Marshalling
makes WASM slower. The 3x / > 1 ms gate from task #1710 is far from met, so re-theme, token resolution and similar array work stay in TypeScript.

## Dev speed (tiny crate; real crates will be slower, so these are floors, not forecasts)
| Step | Time |
|---|---|
| cold `cargo build --release --target wasm32-unknown-unknown` | 1.3 s |
| cold / incremental `cargo test` (native) | 0.33 s / 0.30 s |
| `node --test` (TS, 2 tests) | 0.07 s |
| WASM size | 20 KB |

## Not measured yet
Where Rust should still win: tree diff/merge on big trees, layout (Taffy), 8K image pyramid vs `sharp`, MP4 encode, search. Those need their own runs. A heavier
op is needed before concluding WASM never pays; this only shows simple array transforms do not.
`cargo-nextest` and `wasm-pack` are not installed.

## Pass 2: heavier ops, 20,000 nodes (`bench2.mjs`, µs per call)
| Op | TypeScript | WASM | WASM + SIMD128 |
|---|---|---|---|
| Hit-test (top-most rect under a point) | 64 | 47 (1.4x) | 47 |
| Cull (count rects in the viewport) | 99 | 75 (1.3x) | 71 (1.4x) |
| Property diff (80k u32 compared) | 514 | 28 (18x) | 12 (42x) |

Outputs match in all three. WASM wins big only on bulk compare scans (diff, auto-vectorised); branchy per-node loops (hit-test, cull) gain ~1.3-1.4x.
Absolute times are tens to hundreds of microseconds at 20k nodes, so none of these is a bottleneck today and none saves the 1 ms gate in #1710.
Read: keep the document in TS first; use Rust (native in the helper first) for bulk work that grows with project size (diff/merge of whole projects,
image work), and re-measure when a real project exceeds ~100k nodes. `-C target-feature=+simd128` is worth turning on if WASM is used.
