# Dev speed floor: TypeScript toolchain on this Mac (task #1722, 2026-11-02)

Synthetic project: 300 modules + 300 test files (600 files, ~2.1k lines, each module imports the previous one), M2 Pro, Node 24. `npm i -D typescript @typescript/native-preview vitest @biomejs/biome`.
| Step | Time |
|---|---|
| `tsc -p .` (TypeScript **7.0.2**, the native compiler: `tsc` and `tsgo` are the same speed now), cold / warm | 0.70 s / 0.25 s |
| `biome check src` | 1.04 s (includes `npx` start-up) |
| `vitest run`, one test file | 0.39 s |
| `vitest run`, all 300 test files | 6.64 s (about 22 ms per file of transform and worker overhead) |
Reading: type check and lint are effectively instant at this size; **the test runner is the slowest step**. Real code is larger, so these are floors. The 10 s target for "TS check + unit tests" is met with room; keep it by running only affected tests on save
(`vitest --changed`), and tune the full run (`pool: 'threads'`, `isolate: false` where safe) when it passes ~5 s. Rust numbers are in `spikes/core/RESULTS.md`: cold wasm release build 1.3 s, native `cargo test` 0.3 s for a tiny crate.
