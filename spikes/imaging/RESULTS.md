# Spike #1708 (8K part): image pyramid, sharp vs Rust (2026-11-02)

Test image: the lake photo upscaled to 7680x4320 (synthetic: less detail than a real 8K bunker photo, so decode is faster than reality), JPEG q90, 3.4 MB.
Levels 1920 / 960 / 480 wide, JPEG q80, M2 Pro, warm runs. `sharp-bench.mjs` (sharp 0.34, libvips) vs `src/main.rs` (`image` 0.25, `imageops::resize` Triangle).

| Path | First 1920 px preview | Full 3-level pyramid | 512 px tiles of the 3840 level |
|---|---|---|---|
| sharp (libvips) | 65 ms | 148 ms | 140 ms |
| Rust `image` crate (decode 106 ms, then resize + encode) | n/a (decode 106 ms first) | 480 ms | not built |

sharp is ~3.2x faster: libvips shrinks while decoding the JPEG and uses SIMD resizers. Both are far inside the targets (first tiles < 800 ms, pyramid < 5 s).
Decision: **use sharp for image work** (a Node sidecar or the helper calling libvips); a Rust path would need `fast_image_resize` and DCT-scaled decoding to compete, and
is not worth it at these numbers. Re-test with a real 8K bunker photo (more detail, larger file) before Gate 1.

## Pass 2: a real 8K photo (auto-label mattress class, 7680x4320 JPEG, 10.3 MB; read-only local copy, git-ignored; 2026-11-02)
| Path | First 1920 px preview | Full 3-level pyramid | 512 px tiles of the 3840 level |
|---|---|---|---|
| sharp (libvips) | 100 ms | 249-253 ms | 175 ms |
| Rust `image` crate (decode 161 ms, then resize + encode) | n/a | 530-586 ms | not built |
The synthetic result holds on a real photo: sharp is ~2.2x faster and both are far inside the targets (first tiles < 800 ms, pyramid < 5 s). Real photos cost ~1.5x the synthetic ones (more detail, 3x the file size). **Decision unchanged: sharp for image work.**
