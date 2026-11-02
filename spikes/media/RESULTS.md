# Spike #1708 (MP4 part): WebCodecs H.264 + mp4-muxer (2026-11-02)

Headed branded Chrome 155 (Chromium builds lack an H.264 encoder), M2 Pro. 300 frames of a 1920x1080 canvas animation (gradient, rounded glass panel, 220 px clock) at 60 fps,
`VideoEncoder` avc1.640028, 8 Mbit/s, keyframe every 60 frames, `mp4-muxer` fastStart in-memory. `node measure.mjs`.

| Encoder | Encode time for 5 s of video | Speed | File | Plays in Chrome |
|---|---|---|---|---|
| hardware (VideoToolbox) | 1863 ms | 2.68x real time | 3.0 MB | yes, 4.98 s, 1920x1080 |
| software | 1976 ms | 2.53x real time | 4.9 MB | yes |

Meets the >= 2x real-time target. Caveats: the frames were plain canvas draws (15 ms total); the expensive part of Motion export, rendering real DOM frames to bitmaps one by one (HyperFrames style),
is NOT included; QuickTime playback not checked; the hardware win here is size and a little speed, so DOM capture will dominate, not encoding.
