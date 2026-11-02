# Spike #1706: canvas frame models (partial, 2026-11-02)

Headed Chrome 155 (real GPU), M2 Pro, display 120 Hz (one frame = 8.3 ms), 1440x900. 20 frames: 8 TV 1920x1080, 6 phone, 3 popup,
3 email; each has a looping CSS animation and a backdrop-filter glass panel. One transformed world layer. Pan 4000 px at
0.25 zoom over 2.5 s, zoom 0.1 to 0.6 over 2.5 s, then 30 Tier-0 edits (a CSS variable) on visible frames, timed to the next
frame. `node measure.mjs 20`; raw rows in `run-n20.log` and `results-n20.json`. Run while no other heavy job was running
(the first pass was contaminated by Playwright runs and a hang, discarded).

| Model | Freeze offscreen | Pan p95 | Zoom p95 | Tier-0 p50/p95 | Chrome RSS |
|---|---|---|---|---|---|
| plain DOM, `contain:strict` | no / yes | 9.2 / 9.3 ms | 9.2 / 9.2 ms | 8.3 / 8.4-8.8 ms | 939 / 927 MB |
| shadow roots | no / yes | 9.3 / 10.2 ms | 9.2 / 16.8 ms | 8.3 / 9.3 ms | 966 / 805 MB |
| same-origin iframes | no / yes | 9.1 / 9.3 ms | 9.0 / 9.3 ms | 8.3 / 9.1-9.3 ms | 1007 / 994 MB |
| sandboxed iframes (postMessage) | no / yes | 9.3 / 9.2 ms | 9.3 / 9.3 ms | 8.2 / 8.9 ms | 865 / 981 MB |

## What this says
- At 20 frames, **every model pans and zooms at the display refresh rate with no dropped frames** (0 frames over 20 ms in 300).
  Frame time is not the problem at this size; choose the model on other grounds.
- **Sandboxed iframes cost nothing measurable** for a Tier-0 edit: postMessage to the frame and back to the next paint was
  8.2 ms p50, the same as direct writes. So the extension's opaque-origin sandbox pages are fine for edits.
- **Gotcha found:** Chrome pauses `requestAnimationFrame` inside an offscreen sandboxed iframe, so an edit acknowledged
  through rAF never returns for frames that are not visible. Acks must not depend on rAF; edit offscreen frames without waiting for paint.
- **Memory is above the 600 MB target:** about 0.9-1.0 GB total Chrome RSS for 20 live frames, in every model. Freezing
  offscreen frames did not reliably reduce it. The bitmap level-of-detail (not built) is what would, so the budget or the LOD
  needs work before Gate 1.

## Not measured yet
Bitmap LOD swap (capture time, flash), blur after zoom settles, 40+ frames, an 8K image frame, live editing inside the
extension page itself (see #1714), a glass layer over the moving canvas (see liquid glass note).

## Pass 2: glass over the moving canvas, and 40 frames (same-origin iframes, freeze on; `run-glass.log`)
| Overlay (6 glass islands, backdrop blur) | n=20 pan p95 / RSS | n=40 pan p95 / RSS |
|---|---|---|
| none | 9.2 ms / 793 MB | 8.9 ms / 1060 MB |
| Liquid Glass (rim, sheen) | 9.1 ms / 1010 MB | 9.1 ms / 1063 MB |
| Liquid Glass + edge refraction (SVG displacement in backdrop-filter) | 9.3 ms / 1008 MB | 9.1 ms / 1067 MB |
No dropped frames in any run (0 of 300). Glass and even refraction are free on this GPU at these sizes; 40 frames use about the same memory as 20
(~1.06 GB), so memory is dominated by something other than frame count here (the animated, blurred content). Zoom settle spikes of 33-42 ms appear in all variants.

## Pass 3: memory and freeze modes (same-origin iframes, 40 and 80 frames, `run-freeze.log`, 2026-11-02)
| Freeze mode for offscreen frames | n=40 RSS / pan p95 | n=80 RSS / pan p95 | Notes |
|---|---|---|---|
| none | 902 MB / 9.0 ms | 999 MB / 9.1 ms | |
| `visibility:hidden` | 849 MB / 8.8 ms | 943 MB / 8.8 ms | -6% |
| `display:none` | **789 MB / 9.0 ms** | **911 MB / 9.3 ms** | -12% / -9%, no jank |
| unload (`src=about:blank`, reload on view) | 926 MB / 9.2 ms | 1020 MB / 9.1 ms | no saving, Tier-0 p95 11.4 ms and a 59 ms zoom spike at n=80: worse |
- **Baseline matters:** 2 frames already read 868 MB. That is mostly Chrome itself (browser, GPU and renderer processes, a headed window under Playwright). Going from 40 to 80 frames adds ~100 MB: **~2.5 MB per frame** for this content. The old "1 GB for 20 frames" worry and the 600 MB target were the wrong metric; budget **marginal MB per frame**, and re-measure with real UIs (images, fonts, video).
- **Level-of-detail decision (provisional): freeze-only with `display:none` for offscreen frames.** No bitmap capture: frame time is already at the display rate at 80 frames, and bitmap capture adds an async step and blur-on-swap risk. Revisit if real content (8K images, video, heavy blur) pushes the frame time or memory.
- Pan p95 stays 8.8-9.3 ms (display refresh) at 80 frames in every mode: 0 dropped frames out of 300.
