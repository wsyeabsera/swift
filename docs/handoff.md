# Handoff (2026-11-02, fourth goal hour in progress)

## Fourth hour (read first): editing basics, all in `app/src`, verified by `npm run typecheck`, `npm test` (47), `npm run e2e` (pass)
- Autosave/restore of the design (`doc.ts`, localStorage, 1 s debounce, all-or-nothing parse, save errors shown, Reset button); Spark ids continue after restore.
- Spark: Keep take / Discard takes (`kept` flag on FrameDef), Cancel Spark (AbortSignal through runSpark/runSay; late ops dropped, no repair turn), cap of 8 unreviewed takes (`canSpark`).
- ⌘D duplicate frame (`canvas/frames.ts`), Delete removes the selected element (one undo step via snapshot; frame root protected), ⌘0 fit, ⌘1 actual size, Escape deselects.
- Local tier (`say/local.ts`): bigger/smaller/hide/show/opacity N%/color/background/size on the SELECTION apply instantly with no Claude; else Claude. MLX router (#1709) not wired yet.
- Gotcha: e2e selection carries over between steps (Layers shows the SELECTED frame): clear/click the root before picking layers.
Next: #1673 project file on disk via helper + switcher, #1734 smaller subtree summary (needs the real-Claude regression `spikes/latency/say.mjs`), MLX router, #1721 re-plan.


## Third hour: the app exists (read this first)
Built in `~/Hobby/swift-canvas`, all verified (`npm run typecheck`, `npm test` 29, `npm run helper:test` 27, `npm run e2e`, `npm run e2e:contrast` 48/48): web app + MV3 extension + Rust helper; canvas (20 sandboxed frames, pan/zoom, freeze, bridge); select/layers/inspector/undo; **Say** through the real local Claude Code (29/30 valid, `docs/slice.md`); **Spark x4** (4 distinct real takes in 10-14 s); theme pipeline with Appearance popover; **Import** brand tokens from a repo folder (scanner run on hearth, research-radar, auto-label). Commands in CLAUDE.md. The owner said "start the tasks" so the recommended answers of #1669 were used and #1670 sign-off is NOT recorded: revisit on review.
Next: #1713 local tier (token/property edits instant), #1734 smaller subtree summary, #1731 repair + `ask` UX, #1733 Spark cap/memory guard + cancel/keep (#1739), #1673 project file + switcher, #1710 Rust core only if needed, #1730 port `--sheen` to the design KIT, #1721 re-plan.


## State
- Mockups: https://claude.ai/artifact/9JQD7AcKDh7FgGxhPurcxh version 22: 25 boards, all pass `node qa/smoke.mjs` (design folder `~/Hobby/swift-canvas-design`), contrast 16/16 at thin/regular/thick glass.
- All Phase 1 spikes are done and written up in `spikes/*/RESULTS.md`; decisions in `docs/architecture.md` (draft 2). ws-command project `swift`, groups "Swift Canvas 0..5" (tasks #1664-#1750).
- Hard rules: all Claude work through the local Claude Code login (no API key); Liquid Glass UI; speed is the product; quality bar (failure modes tested).

## Blocked on the owner
- #1669 (11 product questions, recommended answers in the task and in `docs/signoff.md`) and #1670 (sign-off of every board). The app scaffold #1671 waits on #1670 and nothing else of substance.

## Next, in order
1. Owner: review the boards using `docs/signoff.md`; answer #1669; sign off #1670.
2. #1671 scaffold (web app + extension shell + Rust helper), then #1719 helper security, #1722 inner loop, #1723 fakes (prototype in `spikes/latency/FAKE.md`), #1718 perf CI.
3. #1672 theme/Liquid Glass, #1673 projects, #1674 canvas (one iframe per frame, freeze offscreen with display:none), #1675 node tree, #1710 Rust core (only the parts the spikes proved), then #1717 thin slice, #1677 session pool, #1731 op language (contract: `spikes/latency/OPS-PROMPT.md`).
4. Still to design: #1730 Liquid Glass pass 2 (sheet morphs, radii script).

## Tooling (design folder `~/Hobby/swift-canvas-design/qa`)
`node serve.mjs ~/Hobby/swift-canvas-design` (preview :8797), `node smoke.mjs [Board]` (needs a quiet machine), `node contrast.mjs` (`GL=Thin|Thick`), `node h7.mjs [Board]` (popover rule), `liquid-pilot.html`.
Spike tooling: `spikes/latency/say.mjs` (`V3=1 MANY=1 node say.mjs haiku 30`; `RECORD=` to record fixtures), `spikes/canvas/measure.mjs`, `spikes/host/measure-host.mjs` (needs Playwright 1.64 + its Chromium), `spikes/localmodel` (uv Python 3.12 venv), `spikes/media`, `spikes/imaging`, `spikes/devspeed`.

## Gotchas
- Branded Chrome ignores `--load-extension`; use Playwright's matching Chromium. Python 3.15 has no `sentencepiece` wheel: use `uv venv --python 3.12`.
- Apple's on-device model needs macOS 26 (this Mac is 15.5): the local tier is MLX Qwen3-4B.
- Smoke runs slow down badly when other Chrome jobs run; run it alone.
- The conversation context was > 400k tokens: start fresh with `/clear` and read this file, CLAUDE.md and docs/architecture.md.
