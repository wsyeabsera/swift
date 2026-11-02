# #1716 Build on tldraw / Excalidraw or build our own canvas (provisional, 2026-11-02)

## Found
- [tldraw license](https://tldraw.dev/sdk-features/license-key), [pricing](https://tldraw.dev/pricing), [SDK 4.0 licensing](https://appdevelopermagazine.com/tldraw-sdk-4.0-release-new-starter-kits-and-licensing-model/amp/):
  since SDK 4.0 (Sept 2025) the source is public but under the tldraw license, not MIT. No key needed in development;
  production (HTTPS on a non-localhost domain) needs a key. The free hobby license keeps a "made with tldraw" watermark;
  commercial use needs a paid license (no public price, value-based, 100-day trial).
- Not found (no result): tldraw HTML/custom shape docs, iframe-embed performance. Excalidraw not checked yet (MIT, canvas2D,
  not built for live DOM frames).

## Provisional call
Do not adopt tldraw as the base. Frames are real product UIs at exact device sizes (iframes or shadow roots), the
transform/culling layer is small, and a paid-license and watermark dependency is a poor fit for a tool that may be
distributed. Borrow ideas instead (signals-based store, viewport culling, pointer/selection state machines). Revisit only if
spike #1706 shows our own world layer cannot reach 60 fps with 20 frames.

## Still to do
Read tldraw's custom/HTML shape docs and check an issue or two on many-iframe performance; one search on Excalidraw's
embeddable support. Then close #1716.
