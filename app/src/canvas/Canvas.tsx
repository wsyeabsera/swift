import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { frameDoc, FrameBridge } from './bridge';
import type { FrameDef } from './fixtures';
import { fit, isVisible, panBy, transformCss, zoomAt, type View } from './viewport';

export type SwiftHooks = {
  frames: string[]; view: () => View; setView: (v: View) => void; fitAll: () => void; visibleCount: () => number;
  edit: (frameId: string, el: string, prop: string, value: string) => Promise<{ ok: boolean; ms: number }>;
  get: (frameId: string, el: string, prop: string) => Promise<string | undefined>;
  hit: (frameId: string, x: number, y: number) => Promise<string | null | undefined>;
};
declare global { interface Window { __swift?: SwiftHooks } }
declare const chrome: { runtime?: { id?: string; getURL: (p: string) => string } } | undefined;
const EXT_FRAME = typeof chrome !== 'undefined' && chrome?.runtime?.id ? chrome.runtime.getURL('frame.html') : null;
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/** Infinite canvas: one transformed world layer, one sandboxed iframe per frame, offscreen frames frozen (display:none, spike #1706).
 *  The viewport lives in a ref and is applied to the DOM directly: panning and zooming never re-render React; React re-renders only when
 *  the set of visible frames changes. */
export function Canvas({ frames }: { frames: FrameDef[] }) {
  const hostRef = useRef<HTMLDivElement>(null); const worldRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, s: 1 }); const iframes = useRef(new Map<string, HTMLIFrameElement>());
  const bridges = useMemo(() => new Map(frames.map((f) => [f.id, new FrameBridge(() => iframes.current.get(f.id)?.contentWindow)])), [frames]);
  const [visible, setVisible] = useState<Set<string>>(() => new Set(frames.map((f) => f.id))); const visRef = useRef(visible);
  const sync = useCallback(() => {
    const host = hostRef.current; const world = worldRef.current; if (!host || !world) return;
    const v = viewRef.current; world.style.transform = transformCss(v);
    const { width, height } = host.getBoundingClientRect(); const next = new Set(frames.filter((f) => isVisible(f, v, width, height, 200)).map((f) => f.id));
    if (!sameSet(next, visRef.current)) { visRef.current = next; setVisible(next); }
  }, [frames]);
  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const { width, height } = host.getBoundingClientRect(); viewRef.current = fit(frames, width, height, 90); sync();
    const rect = () => host.getBoundingClientRect();
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = rect(); viewRef.current = e.ctrlKey || e.metaKey ? zoomAt(viewRef.current, e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01)) : panBy(viewRef.current, -e.deltaX, -e.deltaY); sync(); };
    let drag: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; host.setPointerCapture(e.pointerId); host.classList.add('grab'); };
    const move = (e: PointerEvent) => { if (!drag) return; viewRef.current = panBy(viewRef.current, e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY }; sync(); };
    const up = (e: PointerEvent) => { drag = null; host.classList.remove('grab'); if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId); };
    const onMessage = (e: MessageEvent) => bridges.forEach((b) => b.handle(e)); const onResize = () => sync();
    host.addEventListener('wheel', onWheel, { passive: false }); host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
    window.addEventListener('message', onMessage); window.addEventListener('resize', onResize);
    const bridge = (id: string) => bridges.get(id);
    window.__swift = {
      frames: frames.map((f) => f.id), view: () => ({ ...viewRef.current }), setView: (v) => { viewRef.current = v; sync(); },
      fitAll: () => { const r = rect(); viewRef.current = fit(frames, r.width, r.height, 90); sync(); }, visibleCount: () => visRef.current.size,
      edit: async (id, el, prop, value) => { const t0 = performance.now(); const r = await bridge(id)?.request({ t: 'edit', el, prop, value }); return { ok: !!r?.ok, ms: performance.now() - t0 }; },
      get: async (id, el, prop) => (await bridge(id)?.request({ t: 'get', el, prop }))?.value,
      hit: async (id, x, y) => (await bridge(id)?.request({ t: 'hit', x, y }))?.id,
    };
    return () => { host.removeEventListener('wheel', onWheel); host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up); window.removeEventListener('message', onMessage); window.removeEventListener('resize', onResize); delete window.__swift; };
  }, [frames, bridges, sync]);
  return (
    <div ref={hostRef} className="canvas" data-testid="canvas">
      <div ref={worldRef} className="world">
        {frames.map((f) => (
          <div key={f.id} className="fr" style={{ left: f.x, top: f.y, width: f.w, height: f.h, display: visible.has(f.id) ? 'block' : 'none' }}>
            <iframe ref={(el) => { if (el) iframes.current.set(f.id, el); else iframes.current.delete(f.id); }} title={f.title} sandbox="allow-scripts" {...(EXT_FRAME ? { src: EXT_FRAME, onLoad: () => { void bridges.get(f.id)?.request({ t: 'load', html: f.html }); } } : { srcDoc: frameDoc(f.html) })} width={f.w} height={f.h} style={{ border: 0, display: 'block', pointerEvents: 'none' }} />
            <span className="fr-label">{f.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
