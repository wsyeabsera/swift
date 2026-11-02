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
- Python for MLX: `uv venv --python 3.12` (3.15 has no `sentencepiece` wheel).
- Keep outputs short; this repo is built with token cost in mind (ws-command caveman).
