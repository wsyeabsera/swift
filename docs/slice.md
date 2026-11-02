# Thin slice (task #1717), 2026-11-02

Select-and-say, end to end, on the tvdash TV frame: Say bar -> authenticated WebSocket -> Rust helper -> the user's LOCAL Claude Code (no API key) -> streamed JSONL ops -> each line validated and applied on the sandboxed frame as it completes -> undo restores the whole Say in one step.

## Proof
- `npm run e2e` (fake Claude Code replaying `tools/fixtures/say-clock.json`, no network): 3 ops applied (font size, opacity, a token), 1 rejected (unknown id `ghost`), first change 265 ms, undo restores font size and opacity exactly; also checked in the real extension.
- Real Claude Code (`node e2e/real-say.mjs "make the clock bigger and the date a bit dimmer"`, Haiku, a new process per request, cold): clock 230px -> 300px, date opacity 0.7 -> 0.5, **2 ops applied, first visible change 1.32 s, total 1.3 s (wall 1.43 s)**. Inside the 1.5 s target even without a warm session pool.
- Tests: 19 TypeScript (op validation incl. hostile html, line splitting, prompt, Say orchestration with a fake transport), 18 Rust (Origin/token, Say streaming, errors, size and concurrency limits).

## Warm spare (task #1677, added later the same day)
`helper/src/say.rs` keeps one idle pre-spawned `claude` (the spare): prewarmed when a client connects and when the Say input gets focus, used by the next Say (one spare = one Say = clean context), replaced right away, reaped after 120 s idle (~250 MB each), and a spare that died while idle falls back to a fresh process.
Spike (`spikes/latency/spare.mjs`, tiny prompt, 4 runs each): first token 1.02 s cold vs 0.64 s with a spare (-0.39 s). In the app with the real 6 KB-tree prompt: first change 1.10 s and 1.49 s with a spare (n=2) vs 1.32 s cold (n=1): within noise at this sample size. Needs 30+ runs before claiming a gain.

## Where the pieces are
`app/src/say/{ops,prompt,say}.ts` (op language v3 from spikes/latency/OPS-PROMPT.md; untrusted output validated per line), `app/src/helper.ts` (client), `helper/src/say.rs` (spawns `claude` with lean flags; `SWIFT_CLAUDE_BIN` swaps in `tools/fake-claude.mjs`), `app/src/canvas/*` (frames and bridge).

## Not done yet (tasks)
Warm session pool and pre-warm (#1677, #1733), repair turn for rejected lines (#1731), roles and computed styles in the subtree summary (#1734), History node per Say (#1735), local-model tier for token/property edits (#1713), MCP server (#1712), Spark (#1682).
