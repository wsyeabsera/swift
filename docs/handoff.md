# Handoff (2026-11-02, fourth goal hour in progress)

## Fourth hour (read first): editing basics, all in `app/src`, verified by `npm run typecheck`, `npm test` (102), `npm run e2e` (pass)
- Autosave/restore of the design (`doc.ts`, localStorage, 1 s debounce, all-or-nothing parse, save errors shown, Reset button); Spark ids continue after restore.
- Spark: Keep take / Discard takes (`kept` flag on FrameDef), Cancel Spark (AbortSignal through runSpark/runSay; late ops dropped, no repair turn), cap of 8 unreviewed takes (`canSpark`).
- ⌘D duplicate frame (`canvas/frames.ts`), Delete removes the selected element (one undo step via snapshot; frame root protected), ⌘0 fit, ⌘1 actual size, Escape deselects.
- Local tier (`say/local.ts`): bigger/smaller/hide/show/opacity N%/color/background/size on the SELECTION apply instantly with no Claude; else Claude. MLX router (#1709) not wired yet.
- Import → "Use this brand": scanned tokens (plain custom properties only, max 16, `brand.ts`) replace the hard-coded tvdash tokens in Say/Spark prompts; persisted.
- Projects (`projects.ts`): registry in localStorage, per-project design + brand keys (default project keeps the old keys), Import popover lists projects and "Create project" from a scanned folder (starts with one blank screen); switching flushes the autosave, then reloads.
- Durable project files: the helper stores each project at `$SWIFT_DATA_DIR` (default `~/.swift-canvas/<id>.project.json`, atomic writes); the app backs up on every autosave and, when it has NO local copy, restores from the helper on first connect (autosave waits until that attempt finished). The web page and the extension share one project by id.
- Rename a frame: double-click its label (Enter commits, Esc cancels; `renameFrame`). Gotcha: the canvas host uses a NATIVE pointerdown + pointer capture, so React stopPropagation on children is too late; guard in the native handler.
- Say input: ↑/↓ recall earlier requests (`say/history.ts`).
- Spark: skeleton shimmer on takes while Claude paints (`painting` set, `.fr-busy`), Cancel this take, swatches in the switcher.
- Redo: ⌘⇧Z / Redo button (redo stack cleared by any new action; say entries swap snapshots).
- Export button: selected frame as a standalone HTML download (`canvas/exportHtml.ts`).
- "+ phone/desktop/tv" add an empty preset frame (`newFrame`).
- Delete frame button (history entry `frameDel`, undo restores at the same index with its edits; last frame protected).
- Arrow keys nudge the selected positioned element (Shift 10 px; `canvas/nudge.ts`); rapid nudges on the same property within 800 ms coalesce into ONE undo step.
- Enter selects the first child, Shift+Enter the parent (`canvas/tree.ts`).
- Autosave also flushes on visibilitychange→hidden (no 1 s wait).
- Folder picker: Import → Choose… runs the native dialog in the helper (`project.pick`, osascript; `SWIFT_PICKER_BIN` overrides, tests use a fake script); a folder picked in the dialog becomes an allowed root for this helper run (consent by gesture; a folder the client merely names stays refused); empty folders show an empty state.
- Shift+2 zooms to the selected frame.
- "?" opens the shortcuts sheet (`Shortcuts.tsx`; keep SHORTCUTS in sync when adding keys).
- Frame ▾ menu in the tools bar holds + presets, Export HTML, Delete frame, Reset design (no overflow at 1280 px; the demo Clock bigger button is gone). Keys are unchanged.
- Project files: Frame ▾ → Export project file / Open project file… (`projectFile.ts`, version 1 JSON with name, frames, brand; opens as a NEW project, never overwrites; junk refused with a reason).
- Memory guard (helper `mem.rs`): a Say/Spark take is refused with a clear message when available memory (vm_stat free+inactive+speculative) is below `SWIFT_MIN_FREE_MB` (default 1200); macOS only, allows elsewhere.
- Frame ▾ → Compare with original: selected take/copy + its original fill the view (`canvas/compare.ts`). Rule of thumb: new toolbar actions go in a menu; the bar overflow is asserted in e2e.
- Big frames (#1734): over 6000 chars the Say prompt carries an outline of every element + the selected element markup (bridge `outer`), not a truncated tree (`treeContext`). Real Claude on an 18 KB frame (`node e2e/real-big-say.mjs "make the text of item 70 red"`): 1 applied, first change 1.4 s. The 30-request spike on small frames was not re-run (small frames are unchanged).
- Drag the selected positioned element to move it (Canvas `onMove` → App `moveElement`; press inside the selection box = move, elsewhere = pan; live left/top edits, ONE undo step via a start snapshot). Static elements are not draggable (no left/top).
- Resize: a round handle at the bottom-right of the selection (not on a frame root) drags width/height (live, 4 px floor, ONE undo step).
- e2e perf budgets live in `e2e/budgets.json` (Tier-0 edit p95 16 ms, token swap p95 16 ms (measured 0.4 ms), first edit 50 ms, pan/zoom frame gap p95 34 ms (measured 9.3 ms)); a regression fails `npm run e2e` with "BUDGET FAILED: <name> measured X >= limit Y" (proven by setting a limit to 1).
- Suggestion chips above the Say bar for the selection (`say/suggest.ts`: Bigger/Smaller/Bold/Hide + brand colours); each chip runs the local tier (instant).
- Layers: an eye button per element toggles `visibility:hidden` (undoable; the bridge tree reports own inline `hidden`).
- New projects from a scanned folder start with an ON-BRAND screen (`canvas/starter.ts`: bg/fg/accent/card/border tokens as CSS variables) instead of a generic dark one; arrow nudges are serialized (a held key repeated faster than the props round trip and lost presses: found by the e2e hold check).
- Fixed: the default frame was hard-coded to `tv`, so Layers/Say/Spark/export targeted a missing frame in other projects; it is now the selection, else the first frame.
- Shared library (`library.ts`): Frame ▾ → Library: Save selection (markup + origin project, localStorage, shared across projects, max 50 x 20 KB) and click an item to insert it into the selected frame (ids de-duplicated to x-2, one undo step).
- Re-theme on insert (`retheme.ts`): a library item carries its origin brand tokens; inserted into ANOTHER project, literals equal to an origin token value become `var(<target token of the same name or role>, <literal>)`. Unit-tested and e2e-tested across projects (a "radar" card inserted into tvdash: "re-themed 2 colours", markup has var(--mu, ...)).
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
