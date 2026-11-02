# Swift Canvas

AI-native desktop design tool. Read `docs/architecture.md` first. Hard rules: all Claude work goes through the local Claude Code login (never an API
key), Liquid Glass UI, speed is the product, quality bar (failure modes tested, errors not swallowed).

## Where things are
- `spikes/*/RESULTS.md`: measured results (canvas, latency, host, localmodel, core). Re-run a spike before trusting an old number.
- Design: `~/Hobby/swift-canvas-design/project` (boards `*.dc.html`, `KIT.md`). Preview: `node ~/Hobby/swift-canvas-design/qa/serve.mjs ~/Hobby/swift-canvas-design`
  (http://127.0.0.1:8797/). Tests: `cd ~/Hobby/swift-canvas-design/qa && node smoke.mjs <Board>` (real clicks, covered-button detection) and `node contrast.mjs`.
- Tasks: ws-command project `swift`, groups "Swift Canvas 0..5".

## Working rules
- Measure before choosing a language or host; write numbers into the nearest RESULTS.md.
- Tests must not call real Claude: use the record/replay fakes (task #1723); real Claude only in the nightly eval.
- Playwright extension tests need the Playwright-matched Chromium (branded Chrome ignores `--load-extension`).
- Extension gotcha (found 2026-11-02): inline `srcdoc` frames inherit the extension page's CSP, so their bridge script is blocked. In the extension, frames are the manifest sandbox page `extension/frame.html` (+ `frame.js`, copied from `app/src/canvas/bridge-frame.js` by `npm run build`) and receive the design by a `load` message; the dev web page uses inline srcdoc. A test guards the two copies against drift.
- Python for MLX: `uv venv --python 3.12` (3.15 has no `sentencepiece` wheel).
- Keep outputs short; this repo is built with token cost in mind (ws-command caveman).

## Commands (the app, since 2026-11-02)
- `npm run dev` (Vite on http://localhost:5173, HMR), `npm run build` (writes the extension's app page into `extension/app`), `npm run typecheck` (tsc 7), `npm test` (Vitest), `npm run test:changed`.
- `npm run helper` (Rust helper on 127.0.0.1:7431; needs `SWIFT_DEV=1` for the dev page, or `SWIFT_ALLOWED_ORIGINS=chrome-extension://<id>` and `SWIFT_HELPER_TOKEN=<token>`), `npm run helper:test` (8 tests incl. a real WebSocket server).
- `npm run e2e`: builds, starts helper + dev server, loads the unpacked extension in Playwright's Chromium, checks web page and extension connect and a wrong origin is refused. Load the extension by hand: chrome://extensions -> Load unpacked -> `extension/`.
- `npm run e2e:contrast`: Liquid Glass contrast in the real app: 8 backdrops x dark/light x thin/regular/thick (48 combos), WCAG >= 4.5 for text and muted text; run it after ANY theme or glass change (it found two failures the design-folder check missed: the mesh backdrop was never covered there). `node e2e/real-say.mjs "<request>"` runs one Say against the REAL Claude Code (uses a little subscription).
- Layout: `app/` (React + Vite, strict TS), `extension/` (MV3 shell), `helper/` (Rust, tungstenite), `e2e/`, `spikes/`, `docs/`.
