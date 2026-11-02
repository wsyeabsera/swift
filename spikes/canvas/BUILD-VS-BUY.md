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

## Update (2026-11-02): custom shapes and performance
- [Custom shape](https://tldraw.dev/examples/shapes/tools/custom-shape): shapes render through `HTMLContainer` and "you can return any valid JSX", so real HTML UI inside a shape is possible. The built-in [embed shape](https://tldraw.dev/sdk-features/embed-shape) shows iframes (sandbox permissions configurable). Not confirmed: arbitrary iframes of our own UIs at exact device sizes, or many of them.
- [Performance](https://tldraw.dev/sdk-features/performance): culling and a `debouncedZoomThreshold` (default 500) that swaps to a simplified render while zooming, thousands of shapes (`maxShapesPerPage` 4000). Same ideas as our freeze-offscreen result.
- **Final call: do not adopt tldraw.** It could host our frames, but our own world layer already pans and zooms 80 live frames at the display refresh rate (spikes/canvas), the paid-license/watermark terms remain, and we need exact iframe viewports, sandboxing and Tier-0 edits by postMessage, which we would be fighting the SDK to do. Borrow: signals-style store, culling, simplified render while zooming. Excalidraw (canvas2D, not built for live DOM frames) not pursued.
