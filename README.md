# Swift Canvas

An AI-native design tool. Speed of select-and-edit is the selling point; floating Liquid Glass UI over photo backdrops; works on any project (tvdash, research-radar, auto-label, itself). All Claude work goes through your **local Claude Code login** (no API key, no API calls).

## What works today
- Pan/zoom canvas of sandboxed frames; select, move (drag), resize (handle), nudge (arrows), delete, duplicate, rename, add preset frames; layers (with eye toggle) and inspector; full undo/redo.
- **Say** (⌘K): streamed ops from the local Claude Code (first change about 1 s); a local rules tier answers common requests instantly; suggestion chips for the selection.
- **Spark ×4**: four parallel directions on cloned frames (keep / discard / cancel / compare).
- **Projects**: switcher, per-project design and brand, import from a repo folder (native picker), on-brand starter screens, portable project files, durable helper copy, shared library with re-theme on insert.
- Themes (8 backdrops, dark/light, accents, glass thickness) with a contrast check.

## Run it
```
npm install
npm run dev                      # app on http://localhost:5173
SWIFT_DEV=1 npm run helper       # helper on 127.0.0.1:7431 (needs the `claude` CLI logged in)
```
Or load `extension/` unpacked in Chromium after `npm run build` (the helper then needs `SWIFT_ALLOWED_ORIGINS=chrome-extension://<id>`).

## Claude Code plugin
```
/plugin marketplace add wsyeabsera/swift
/plugin install swift-canvas@swift
```
Adds the `swift` MCP server (`swift-canvas-helper mcp`). On enable it asks for `helper_path` (default `swift-canvas-helper` on PATH) and `data_dir` (`SWIFT_DATA_DIR` of the running helper; empty = `~/.swift-canvas`). The helper and app must be running. Check: `npm run test:plugin`, `claude plugin validate .`.

## Use it from Claude Code
Register the in-app MCP server once (`claude mcp add swift -- swift-canvas-helper mcp`), keep the helper and an app tab open, then ask Claude Code to start from a template, fill it from your brief and repo data, check it, screenshot it and export it. Steps, the tool list and the design loop: `docs/claude-code-quickstart.md`. Writing your own templates: `docs/template-authoring.md`. Not built yet: starter templates, template screens in the app, `swift-canvas new`.

Watch a run from a second terminal: `swift-canvas-helper watch` prints one read-only line per step (tool start/end, ops) of what Claude Code does through MCP, and reconnects if the helper restarts. It is a plain text tail of the helper's live event stream (`live.subscribe`); it cannot send anything.

## Test it
`npm run typecheck`, `npm test` (Vitest), `npm run helper:test` (Rust), `npm run e2e` (real unpacked extension + web page, speed budgets in `e2e/budgets.json`), `npm run e2e:contrast`. Run the UI tests in the background; they own ports 7431 and 5173. Timings: `docs/dev-speed.md`.

## Docs
- `docs/claude-code-quickstart.md`, `docs/template-authoring.md`, `docs/handoff.md` (read first), `docs/architecture.md`, `CLAUDE.md` (rules and commands), `spikes/*/RESULTS.md` (measured numbers).
- **V1 mockups (UI source of truth):** https://claude.ai/artifact/9JQD7AcKDh7FgGxhPurcxh · design files `~/Hobby/swift-canvas-design/project` (boards `*.dc.html`, `KIT.md`).

Work is tracked as ws-command groups (project `swift`).
