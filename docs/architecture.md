# Swift Canvas: architecture (draft 2, 2026-11-02)

Status: **draft 2: all Phase 1 spikes are done** (#1706, #1707, #1708, #1709, #1714, #1716). Decisions marked *measured* come from the spikes in `spikes/*/RESULTS.md`; *assumed* means not measured yet.
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
| Frames | one iframe per frame (sandboxed in the extension); edits by postMessage | all 4 models pan/zoom at display rate with 20 and 40 frames; sandboxed Tier-0 edit 8.2 ms = same as direct (spikes/canvas) | measured; memory is ~2.5 MB per extra frame on a ~870 MB Chrome baseline; offscreen frames: `display:none` (-12%), no bitmap LOD needed yet; an 8K image frame costs ~100-150 MB and no frame time (preview while zoomed out, tiles near 100%) |
| Frame gotcha | acks from offscreen sandboxed frames must not wait on rAF | Chrome pauses rAF there | measured |
| Glass | Liquid Glass in the shared `.gl` rule; refraction optional | glass + refraction over the moving canvas: pan p95 9.1 ms at 40 frames | measured |
| Say (hot path: JSON text, not MCP tools: first op 0.7-1.3 s vs 1.3-2.7 s through a tool) | warm Haiku session (CLI stream-json or SDK streaming input; SDK `query()` cold 0.9-1.4 s, `prewarm()` no clear gain), subtree in, JSONL ops out, apply op-by-op | first complete op 0.66-1.27 s, 5/5 valid; Sonnet 1.1-1.9 s, 4/5 valid (spikes/latency) | measured, small sample |
| Spark | N parallel sessions, pool with idle shutdown | 12 real Say sessions: cold first paint 1.5-1.8 s, warm 0.85-1.4 s, 12/12 valid; ~3.0 GB RSS for 12 processes; usage burn not measured (spikes/latency) | measured, memory is the cost |
| Local models | MLX Qwen3-4B routes token / property / full | 97% (29/30), median 199 ms with a cached prefix (spikes/localmodel); Apple's model unavailable (macOS 15.5) | measured, optimistic |
| Language split | TS for UI/Claude/MCP/document; Rust for the helper and bulk compute | re-theme 5k nodes: TS 2.5 us vs WASM 2.7 us; 20k-node diff 514 us vs 28 us (42x with SIMD); hit-test 1.4x (spikes/core) | measured; WASM only for bulk scans |
| Build on tldraw? | No | paid license + watermark for production; no HTML-shape evidence (spikes/canvas/BUILD-VS-BUY.md) | provisional |

## Rust core crate gate decision (task #1710, from spikes/core/RESULTS.md, 2026-11-02)
**Decision: defer the shared crate; keep the document, tokens and edits in TypeScript. If bulk work is needed first, build it native-only in the helper. Do not ship WASM yet.**
- Simple array ops give no WASM win: re-theme 5000 nodes TS 2.48 us vs WASM 2.68 us (3.30 us with copy in/out). The 3x / > 1 ms gate is far from met.
- Branchy per-node loops at 20k nodes gain only 1.3-1.4x (hit-test 64 -> 47 us, cull 99 -> 75 us). Only the bulk compare scan wins big: property diff 514 us -> 28 us (18x), 12 us with SIMD128 (42x). All absolute times are tens to hundreds of microseconds, so none is a bottleneck.
- Cost side (tiny crate, a floor): WASM build 1.3 s cold, 20 KB; native `cargo test` 0.30 s incremental. Cheap, but a second toolchain and marshalling layer is not justified by the gains above.
- What would change the answer: a real project over ~100k nodes where diff/merge or hit-test exceeds the frame budget (re-measure then; native-only in the helper for project-wide diff/merge, native+WASM only if the browser side needs it, with `+simd128`); or measured wins on the unmeasured ops (Taffy layout, whole-tree merge, 8K pyramid vs `sharp`, search, MP4 encode).

## Update 2026-11-03: `core/` crate and in-app MCP server (tasks #1710, #1712)
- **`core/` (Rust, native only, no WASM).** Node tree with stable ids, typed ops (`set`, `token`, `text`, `add`, `remove` + `insert`/`replace` so every op has an exact inverse), 3-way merge (per-property last-writer-wins), token resolver. TS types (ts-rs) and JSON Schema (schemars) are generated into `app/src/generated/` (`npm run gen:core`; a test fails when they are stale). proptest: any op sequence then its inverses restores the tree exactly; merge is deterministic, idempotent and commutes for disjoint edits.
- **The renderer does NOT use it (gate result, spikes/core/RESULTS.md): simple ops, tokens and edits stay in TypeScript.** The crate earns its place in the helper: it validates and dry-runs every op batch arriving from MCP before the app sees it.
- **MCP server:** `swift-canvas-helper mcp` (stdio, JSON-RPC 2.0, protocol 2024-11-05, no SDK). Tools: `read_subtree`, `apply_ops` (batch, max 200, validated + dry-run by core, applied as ONE undo step), `set_token`, `undo`. Use: `claude mcp add swift -- swift-canvas-helper mcp` or `claude -p --mcp-config <file> --strict-mcp-config` (config: `{"mcpServers":{"swift":{"command":"<path>/swift-canvas-helper","args":["mcp"]}}}`; set `SWIFT_DATA_DIR` in `env` if the helper uses a non-default one). The helper must be running with the app open.
- **Auth path for the MCP process:** the helper writes `<data dir>/mcp.json` (`{port, token}`, mode 0600) at start; the MCP process connects to the same WebSocket with `role=mcp` and the token and NO Origin header. A web page cannot take this path (browsers always send an Origin); such a connection may only send `mcp.call`/`ping`. The app registers itself with `mcp.register` and answers relayed `mcp.req` calls (`app/src/mcp.ts`), re-validating ops with the Say rules (`checkLine`). Not the Say hot path.

## Not measured yet (do before Gate 1)
Bitmap level-of-detail when zoomed out; 8K image pyramid (Rust vs `sharp`); MP4 encode; real Spark (memory, subscription usage per Spark); folder-handle
persistence (File System Access); side panel and DevTools surfaces; Prompt API in branded Chrome; 60 s+ real streams; Rust incremental build times on a real crate.

## Budgets (targets; change only with a measurement)
Tier-0 edit < 16 ms (measured 8-9 ms); Say first visible change <= 1.5 s (measured ~0.7-1.3 s on Haiku); pan/zoom 60 fps+ with 20 frames (measured);
Spark first paint < 2 s (not measured); contrast >= 4.5 on every backdrop in both modes (`qa/contrast.mjs`, passes).

## Draft 2 changes (after the spikes)
- **Say hot path streams JSON ops as text and applies them line by line**; the in-app MCP server is for heavy multi-step work and Claude Code sessions (MCP tool path: first op 1.3-2.7 s, totals up to 9.5 s). Op language v3 (set, token, text, add, remove, ask), tested prompt in `spikes/latency/OPS-PROMPT.md`: 29/30 valid on 30 varied requests; task #1731.
- **Say latency, 30 varied requests (Haiku, one warm session):** first visible change p50 1.15-1.24 s, p95 2.0-3.1 s (creative `add` requests are the slow tail). Budget by route: token/property edits answered by the local tier first (instant preview), Claude for creative ones.
- **Spark:** 12 parallel sessions: cold first paint 1.5-1.8 s, warm 0.85-1.4 s; ~250 MB per session (~3 GB for 12): pool with a cap and idle shutdown. ~5.3k input tokens per Say.
- **Canvas:** 80 frames pan/zoom at the display refresh rate; memory = ~870 MB Chrome baseline + ~2.5 MB per extra frame; freeze offscreen frames with `display:none` (-12%); no bitmap LOD needed yet; unloading frames hurts.
- **Language split:** TypeScript for UI, document, tokens, Claude calls, MCP; images via `sharp` (real 8K photo: 100 ms 1920 px preview, 250 ms pyramid; 2.2x faster than the plain Rust path); Rust/WASM only for bulk scans (20k-node diff 18x, 42x with SIMD128) and helper-side work, when a project size makes it matter; MP4 via WebCodecs (2.7x real time).
- **Local tier:** MLX Qwen3-4B routing 97% / 199 ms; Apple's on-device model is not available on macOS 15.
- **Liquid Glass:** KIT.md section I; contrast checker `qa/contrast.mjs` (16/16 >= 4.5); popovers close on Escape with focus on the trigger (H7 addendum).

## Dev speed floor (spikes/devspeed): `tsc` 7 (native) 0.25-0.7 s for 300 files, Biome ~1 s, Vitest one file 0.39 s and 300 files 6.6 s: the test runner is the slowest step; run affected tests on save.

## Commands (until the scaffold exists)
`node spikes/latency/say.mjs haiku 5` (Say), `MANY=1 V3=1 node spikes/latency/say.mjs haiku 30`, `node spikes/canvas/measure.mjs 20`, `node spikes/host/measure-host.mjs`,
`spikes/localmodel/.venv/bin/python spikes/localmodel/route2.py`, `cd ~/Hobby/swift-canvas-design/qa && node smoke.mjs | contrast.mjs | h7.mjs`.
