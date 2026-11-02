# Spike #1714: Chrome MV3 extension host + local helper (2026-11-02)

Playwright 1.64 + its Chromium 1248 (headed), unpacked extension in `ext/`, Node helper in `helper.mjs` (raw WebSocket, no deps).
`node measure-host.mjs`; raw output in `results.json`. (Branded Chrome 155 would not load the unpacked extension; the Playwright
Chromium did. Playwright-core 1.56 hangs with the newer Chromium: use a matching version.)

| Question | Result |
|---|---|
| Rust/WASM in an extension page | works with CSP `script-src 'self' 'wasm-unsafe-eval'` (tiny module instantiated, add(2,3)=5) |
| Per-frame sandboxed pages (manifest `sandbox`) | `100vh` inside = iframe height (500/500): viewport units and media queries are correct; no `chrome.*` inside; **parent cannot read the frame DOM** |
| postMessage round trip to a sandboxed frame | p50 0.1 ms, p95 0.4 ms |
| Localhost helper over WebSocket | 20.2 s stream, 200/200 messages, max gap 107 ms (100 ms interval); no drops |
| Helper access control | a plain web page on `http://127.0.0.1` was REFUSED even with the right token (Origin check); the extension origin + token accepted |
| Capture a live localhost page with computed styles | works through `chrome.scripting.executeScript` (background colour, font, node count) |
| File System Access API in the extension page | `showDirectoryPicker` exists; persisting a handle across restarts NOT tested (needs a user gesture) |
| Chrome Prompt API (Gemini Nano) | `unavailable` in this Chromium build; NOT conclusive for real Chrome with the model |

## Go / no-go
Extension host: **go** for the parts tested. Not tested: 60 s+ streams under real Say load, folder-handle persistence, the
side panel / DevTools surfaces, Prompt API in branded Chrome, popup lifetime. Electron remains the fallback.
Notes: keep the Agent SDK / Claude Code in the helper (extension pages cannot spawn processes); acks to sandboxed frames must not
depend on rAF (see canvas spike).
