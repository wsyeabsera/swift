# V1 design sign-off pack (2026-11-02)

Mockups (version 19, 25 boards, all pass `node qa/smoke.mjs`, contrast 16/16 at thin/regular/thick glass): https://claude.ai/artifact/9JQD7AcKDh7FgGxhPurcxh
Sign-off unblocks the app scaffold (#1671). Tasks: ws-command project `swift`, groups "Swift Canvas 0..5".

## How to review (10 minutes per project)
1. Open the artifact. In the top-left project switcher pick **tvdash**, then walk the boards; repeat with **research-radar** and **auto-label** (the open project follows you across boards).
2. Check each board in dark and light, once at a narrow width. Liquid Glass should read as glass: bright top-left rim, soft sheen, text always legible.
3. Leave comments on the artifact for anything wrong; I fix and republish.

## Boards (what to look at)
| Board | Check |
|---|---|
| Kit | glass, buttons, switcher, fixtures for the three projects |
| Projects | import flow (repo, URL, screenshot, prompt), re-theme a card across projects |
| Home | first run, ready directions per project |
| Canvas | frames of the open project, Say bar, layers + inspector islands, no collisions |
| Spark | wall of directions, keep two |
| Devices | surfaces per project (TV, phone, popup / desktop, email / labeller) |
| Prototype | flows per project |
| Summon | library shelf, origin chips, insert + re-theme |
| Brand | kits per project, compare, share a token |
| Moodboard | references steer directions |
| Critique | findings pinned to the design, before/after |
| Motion | timeline, eases, render |
| Effects | shader stack, per-device frame budget |
| Studio3D | scene outline, camera, lights, export |
| Pulse | speed and skills telemetry |
| Ship | exports per project |
| Appearance | backdrops, mode, accent, glass thickness |
| States | empty, error, offline, import failures |
| Window | extension surfaces: full tab, side panel, popup, DevTools; Electron fallback |
| Account | Claude Code status, usage, limits (no sign-in) |
| History | branches, compare, restore, merge |
| DiagramArch / Speed / Flow / Roadmap | the architecture and plan, drawn as boards |

## Decisions to confirm (recommended answers; reply "yes" or the changes) — also in task #1669
1. Name: keep "Swift Canvas" for now.
2. "Video": animate designs to MP4 from the real UI (measured: capture 19-33 ms/frame, encode 2.7x real time). No AI-generated footage in V1.
3. 3D: three.js scenes + glb import/export.
4. Publishing: Claude artifacts (private) + export into the project repo. No hosting.
5. Personal tool for V1 (local Claude Code login only, no API key, unpacked extension).
6. Spark default 4 directions, 12 on request (12 sessions ~3 GB RAM).
7. Local models suggest and preview only; they never apply an edit alone.
8. Zoomed-out frames: frozen with `display:none`, no bitmap swap.
9. Project file: git-friendly folder is canonical, SQLite is a cache.
10. No multiplayer.
11. Rust where measured (bulk diff/merge, helper side); TypeScript for the document and UI; images via sharp.

## What the spikes already settled (docs/architecture.md)
Chrome extension + local helper host works; frames: one iframe each, freeze offscreen; Say streams JSON ops (29/30 valid, p50 ~1.2 s); Spark 12 sessions first paint 1.5-1.8 s; MP4 export feasible; local routing 97% / 199 ms.
