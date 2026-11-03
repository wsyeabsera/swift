# Dev speed (measured 2026-11-02, M2 Pro 16 GB, this repo at 87 TS tests / 34 Rust tests)

| Loop | Command | Measured | Target |
|---|---|---|---|
| Type check | `npm run typecheck` (tsc 7 native) | 0.3 s | < 10 s with tests |
| Unit tests | `npm test` (Vitest, 87 tests) | 0.9 s | |
| Rust tests (all) | `npm run helper:test` | 13 s (the Say/WebSocket integration tests wait on real child processes: 4-7 s each file) | < 15 s |
| Rust incremental, lib unit tests only | `touch helper/src/lib.rs; cargo test -q -p swift-canvas-helper --lib` | 1.1 s | |
| Helper build (incremental) | `cargo build -q -p swift-canvas-helper` | 0.4 s | |
| App build for the extension | `npm run build` | 2.4 s | |
| UI edit visible | `npm run dev` (Vite HMR) | median 116 ms, max 250 ms (5 edits, 2026-11-03; see note) | < 1 s |
| Full UI e2e (build + helper + dev server + real unpacked extension, ~35 checks) | `npm run e2e` | 43 s | smoke < 60 s, full < 3 min |
| Contrast, 48 combos | `npm run e2e:contrast` | ~1 min | |

Conclusions
- No e2e split is needed: the whole run is already under the 60 s smoke budget. Re-check when it passes ~50 s; then split by `E2E_FAST` sections.
- `cargo-nextest` is installed but was slower than plain `cargo test` for these tiny tests (earlier spike); not adopted.
- Not installed (nothing to speed up yet): a faster linker (lld/mold), sccache, bacon. Helper builds are already < 1 s incremental.
- Run the UI tests in the background while working (`run_in_background`), and wait for the notification; do not start a manual helper/dev server while they run (port 7431 / 5173).

HMR note (2026-11-03, #1722): file write of a trivial comment appended to `app/src/Appearance.tsx` until headless Playwright Chromium finished fetching the updated module (HMR websocket `update` message, then the `?t=` resource `responseEnd`). Five runs, ms: 250, 121, 28, 26, 116 (median 116, max 250; the first run includes warm-up, spread is large so treat as ~30-250 ms). Excludes React re-render/paint time; the edit was reverted. Not an editor-keystroke-to-pixel measurement.
