# Handoff (2026-11-02, end of the second goal hour)

## State
- Mockups: https://claude.ai/artifact/9JQD7AcKDh7FgGxhPurcxh version 21: 25 boards, all pass `node qa/smoke.mjs` (design folder `~/Hobby/swift-canvas-design`), contrast 16/16 at thin/regular/thick glass.
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
