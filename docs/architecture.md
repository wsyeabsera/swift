# Swift Canvas: architecture (draft 1, 2026-11-02)

Status: **draft**. Decisions marked *measured* come from the spikes in `spikes/*/RESULTS.md`; *assumed* means not measured yet.
Design source of truth: the mockups (https://claude.ai/artifact/9JQD7AcKDh7FgGxhPurcxh) and `~/Hobby/swift-canvas-design/project/KIT.md`.

## Hard rules (owner)
1. All Claude work goes through the owner's **local Claude Code login**. No Anthropic API calls, no API key.
2. The UI is **Apple's Liquid Glass** (KIT.md section I).
3. Speed is the product: fast app, **and** fast build/test/e2e (dev speed).
4. TypeScript-only is *not* a rule; each language must earn its place by measurement.
5. Quality bar: failure modes listed and tested, errors reported not swallowed, fallbacks proven.

## Shape
```
Chrome extension (MV3)                      Local helper (Rust, 127.0.0.1)
  app page / side panel / popup / DevTools   - project files, SQLite, repo folders
  React UI (panels, islands) + imperative    - Claude Code session pool (warm, stream-json)
  canvas, one sandboxed frame per surface    - in-app MCP server of design ops
  postMessage <-> frame script               - local models (MLX Qwen3-4B) for routing
        |  authenticated WebSocket (Origin + token)  |
```
Electron is the fallback host (same web app).

## Decisions and evidence
| Area | Decision | Evidence | Confidence |
|---|---|---|---|
| Host | Chrome MV3 extension + local helper | WASM runs (`wasm-unsafe-eval`), sandboxed frames keep correct `vh`, postMessage 0.1 ms, helper WS 200/200 msgs, Origin check refuses plain pages, `chrome.scripting` captures live pages (spikes/host) | measured, medium-high |
| Frames | one iframe per frame (sandboxed in the extension); edits by postMessage | all 4 models pan/zoom at display rate with 20 and 40 frames; sandboxed Tier-0 edit 8.2 ms = same as direct (spikes/canvas) | measured; memory ~1 GB is over the 600 MB target |
| Frame gotcha | acks from offscreen sandboxed frames must not wait on rAF | Chrome pauses rAF there | measured |
| Glass | Liquid Glass in the shared `.gl` rule; refraction optional | glass + refraction over the moving canvas: pan p95 9.1 ms at 40 frames | measured |
| Say | warm Haiku session (CLI stream-json or SDK streaming input; SDK `query()` cold 0.9-1.4 s, `prewarm()` no clear gain), subtree in, JSONL ops out, apply op-by-op | first complete op 0.66-1.27 s, 5/5 valid; Sonnet 1.1-1.9 s, 4/5 valid (spikes/latency) | measured, small sample |
| Spark | N parallel sessions, pool with idle shutdown | 12 real Say sessions: cold first paint 1.5-1.8 s, warm 0.85-1.4 s, 12/12 valid; ~3.0 GB RSS for 12 processes; usage burn not measured (spikes/latency) | measured, memory is the cost |
| Local models | MLX Qwen3-4B routes token / property / full | 97% (29/30), median 199 ms with a cached prefix (spikes/localmodel); Apple's model unavailable (macOS 15.5) | measured, optimistic |
| Language split | TS for UI/Claude/MCP/document; Rust for the helper and bulk compute | re-theme 5k nodes: TS 2.5 us vs WASM 2.7 us; 20k-node diff 514 us vs 28 us (42x with SIMD); hit-test 1.4x (spikes/core) | measured; WASM only for bulk scans |
| Build on tldraw? | No | paid license + watermark for production; no HTML-shape evidence (spikes/canvas/BUILD-VS-BUY.md) | provisional |

## Not measured yet (do before Gate 1)
Bitmap level-of-detail when zoomed out; 8K image pyramid (Rust vs `sharp`); MP4 encode; real Spark (memory, subscription usage per Spark); folder-handle
persistence (File System Access); side panel and DevTools surfaces; Prompt API in branded Chrome; 60 s+ real streams; Rust incremental build times on a real crate.

## Budgets (targets; change only with a measurement)
Tier-0 edit < 16 ms (measured 8-9 ms); Say first visible change <= 1.5 s (measured ~0.7-1.3 s on Haiku); pan/zoom 60 fps+ with 20 frames (measured);
Spark first paint < 2 s (not measured); contrast >= 4.5 on every backdrop in both modes (`qa/contrast.mjs`, passes).
