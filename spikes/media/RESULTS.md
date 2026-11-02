# Spike #1708 (MP4 part): WebCodecs H.264 + mp4-muxer (2026-11-02)

Headed branded Chrome 155 (Chromium builds lack an H.264 encoder), M2 Pro. 300 frames of a 1920x1080 canvas animation (gradient, rounded glass panel, 220 px clock) at 60 fps,
`VideoEncoder` avc1.640028, 8 Mbit/s, keyframe every 60 frames, `mp4-muxer` fastStart in-memory. `node measure.mjs`.

| Encoder | Encode time for 5 s of video | Speed | File | Plays in Chrome |
|---|---|---|---|---|
| hardware (VideoToolbox) | 1863 ms | 2.68x real time | 3.0 MB | yes, 4.98 s, 1920x1080 |
| software | 1976 ms | 2.53x real time | 4.9 MB | yes |

Meets the >= 2x real-time target. Caveats: the frames were plain canvas draws (15 ms total); the expensive part of Motion export, rendering real DOM frames to bitmaps one by one (HyperFrames style),
is NOT included; QuickTime playback not checked; the hardware win here is size and a little speed, so DOM capture will dominate, not encoding.

## Pass 2: real DOM frames to bitmaps for Motion export (#1744, `dom-capture.mjs`, `dom-frame.html`, 2026-11-02)
Test frame: tvdash-style 1920x1080 idle screen with a rotating aurora gradient, a glass panel with `backdrop-filter: blur(24px)` sliding on an animation, system text. Headless branded Chrome 155, M2 Pro.
Deterministic render: pause all animations and set `currentTime` through the Web Animations API (`document.getAnimations()`), then capture with CDP `Page.captureScreenshot` (`optimizeForSpeed`).
| Capture | ms per frame | fps | Size per frame | 150 frames (5 s at 30 fps) |
|---|---|---|---|---|
| CDP JPEG q85 | 33.2 | 30 | 68 KB | 5.0 s |
| CDP JPEG q95 | 19.0 | 53 | 156 KB | 2.8 s |
| CDP PNG | 57.5 | 17 | 1.66 MB | 8.6 s |
| Playwright `page.screenshot` JPEG q85 | 40.6 | 25 | n/a | n/a |
- **Deterministic: yes.** The same animation time twice gives byte-identical PNGs; a different time differs.
- **Fidelity:** `backdrop-filter` blur, the glass border, gradients and text all survive in the captured frame (checked visually).
- With encoding at ~6 ms per frame (pass 1), a 5 s 1080p30 clip renders in roughly 4-10 s: far inside the < 30 s target. 60 fps doubles it. The transfer of frames from the page to the encoder was not measured (they would be base64 over CDP; in the app the helper can read them directly).
- Not measured: pages with video or iframes of other origins, web fonts still loading (wait for `document.fonts.ready`), frames with canvas/WebGL (needs the same virtual-time control).
- **Decision: Motion export = deterministic time (Web Animations API) + CDP screenshots from the helper + WebCodecs encode.** HyperFrames is not needed for this.
