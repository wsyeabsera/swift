import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { frameDoc, FrameBridge, type TreeNode } from './bridge';
import type { FrameDef } from './fixtures';
import { fit, isVisible, panBy, screenToWorld, transformCss, zoomAt, type View } from './viewport';

export type Sel = { frameId: string; el: string };
export type CanvasApi = {
  frames: string[]; view: () => View; setView: (v: View) => void; fitAll: () => void; fitTo: (ids: string[]) => void; visibleCount: () => number;
  edit: (frameId: string, el: string, prop: string, value: string) => Promise<{ ok: boolean; ms: number; before: string }>;
  get: (frameId: string, el: string, prop: string) => Promise<string | undefined>;
  props: (frameId: string, el: string, props: string[]) => Promise<Record<string, string> | undefined>;
  tree: (frameId: string) => Promise<TreeNode[]>;
  hit: (frameId: string, x: number, y: number) => Promise<string | null | undefined>;
  snapshot: (frameId: string) => Promise<string>;
  outer: (frameId: string, el: string) => Promise<string>;
  load: (frameId: string, html: string) => Promise<boolean>;
  text: (frameId: string, el: string, value: string) => Promise<boolean>;
  add: (frameId: string, parent: string, html: string) => Promise<boolean>;
  remove: (frameId: string, el: string) => Promise<boolean>;
};
declare global { interface Window { __swift?: CanvasApi } }
declare const chrome: { runtime?: { id?: string; getURL: (p: string) => string } } | undefined;
const EXT_FRAME = typeof chrome !== 'undefined' && chrome?.runtime?.id ? chrome.runtime.getURL('frame.html') : null;
/** The canvas API is rebuilt whenever the frame list changes (new bridges), so long-running work (Say, Spark) must not hold on to one instance: this always delegates to the current one. */
export const liveApi: CanvasApi = new Proxy({} as CanvasApi, { get: (_t, k: string) => { const api = window.__swift; if (!api) throw new Error('canvas not ready'); return (api as unknown as Record<string, unknown>)[k]; } });
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/** Infinite canvas: one transformed world layer, one sandboxed iframe per frame, offscreen frames frozen (display:none, spike #1706).
 *  The viewport lives in a ref and is applied to the DOM directly: panning and zooming never re-render React; React re-renders only when
 *  the set of visible frames changes or the selection changes. Selection is found by hit-testing through the frame bridge. */
export function Canvas({ frames, selection, onSelect, revision, onReady, onRename, painting, onMove, onResize }: { painting?: Set<string>; onResize?: (frameId: string, el: string, dw: number, dh: number, phase: 'start' | 'move' | 'end') => void; onMove?: (frameId: string, el: string, dx: number, dy: number, phase: 'start' | 'move' | 'end') => void; frames: FrameDef[]; selection: Sel | null; onSelect: (s: Sel | null) => void; revision: number; onReady?: () => void; onRename?: (id: string, title: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null); const worldRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, s: 1 }); const iframes = useRef(new Map<string, HTMLIFrameElement>());
  const bridges = useMemo(() => new Map(frames.map((f) => [f.id, new FrameBridge(() => iframes.current.get(f.id)?.contentWindow)])), [frames]);
  const [visible, setVisible] = useState<Set<string>>(() => new Set(frames.map((f) => f.id))); const visRef = useRef(visible);
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const selBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null); const selectionRef = useRef(selection); selectionRef.current = selection; const onMoveRef = useRef(onMove); onMoveRef.current = onMove; const onResizeRef = useRef(onResize); onResizeRef.current = onResize;
  const fitted = useRef(false); const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect; const onReadyRef = useRef(onReady); onReadyRef.current = onReady;
  const sync = useCallback(() => {
    const host = hostRef.current; const world = worldRef.current; if (!host || !world) return;
    const v = viewRef.current; world.style.transform = transformCss(v); world.style.setProperty('--inv', String(1 / v.s));
    const { width, height } = host.getBoundingClientRect(); const next = new Set(frames.filter((f) => isVisible(f, v, width, height, 200)).map((f) => f.id));
    if (!sameSet(next, visRef.current)) { visRef.current = next; setVisible(next); }
  }, [frames]);
  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const { width, height } = host.getBoundingClientRect(); if (!fitted.current) { viewRef.current = fit(frames, width, height, 90); fitted.current = true; } sync();
    const rect = () => host.getBoundingClientRect();
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = rect(); viewRef.current = e.ctrlKey || e.metaKey ? zoomAt(viewRef.current, e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01)) : panBy(viewRef.current, -e.deltaX, -e.deltaY); sync(); };
    let drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null; let elDrag: 'move' | 'resize' | null = null; // elDrag: the press started inside the selection, so dragging moves the element instead of panning
    const down = (e: PointerEvent) => { if ((e.target as Element | null)?.closest?.('.fr-label')) return; /* labels are editable: no pan/capture */ drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
      { const r0 = host.getBoundingClientRect(); const w0 = screenToWorld(viewRef.current, e.clientX - r0.left, e.clientY - r0.top); const b = selBoxRef.current; elDrag = (e.target as Element | null)?.closest?.('.sel-h') ? (onResizeRef.current ? 'resize' : null) : b && onMoveRef.current && w0.x >= b.x && w0.x <= b.x + b.w && w0.y >= b.y && w0.y <= b.y + b.h ? 'move' : null; }
      host.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (!drag) return; if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return; const sel = selectionRef.current; if (!drag.moved) { drag.moved = true; if (elDrag && sel) (elDrag === 'resize' ? onResizeRef : onMoveRef).current?.(sel.frameId, sel.el, 0, 0, 'start'); else host.classList.add('grab'); }
      if (elDrag && sel) { const v = viewRef.current; (elDrag === 'resize' ? onResizeRef : onMoveRef).current?.(sel.frameId, sel.el, (e.clientX - drag.sx) / v.s, (e.clientY - drag.sy) / v.s, 'move'); return; } viewRef.current = panBy(viewRef.current, e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; sync(); };
    const up = async (e: PointerEvent) => {
      const d = drag; const wasEl = elDrag; drag = null; elDrag = null; host.classList.remove('grab'); if (d?.moved && wasEl) { const s = selectionRef.current; if (s) (wasEl === 'resize' ? onResizeRef : onMoveRef).current?.(s.frameId, s.el, 0, 0, 'end'); } if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId);
      if (!d || d.moved) return; // a click, not a pan: hit-test the frame under the pointer, top-most first
      const r = rect(); const w = screenToWorld(viewRef.current, e.clientX - r.left, e.clientY - r.top);
      for (const f of [...frames].reverse()) {
        if (!visRef.current.has(f.id) || w.x < f.x || w.y < f.y || w.x > f.x + f.w || w.y > f.y + f.h) continue;
        const reply = await bridges.get(f.id)?.request({ t: 'hit', x: w.x - f.x, y: w.y - f.y }); onSelectRef.current(reply?.ok && reply.id ? { frameId: f.id, el: reply.id } : null); return;
      }
      onSelectRef.current(null);
    };
    const onMessage = (e: MessageEvent) => bridges.forEach((b) => b.handle(e)); const onResize = () => sync();
    host.addEventListener('wheel', onWheel, { passive: false }); host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
    window.addEventListener('message', onMessage); window.addEventListener('resize', onResize);
    const bridge = (id: string) => bridges.get(id);
    window.__swift = {
      frames: frames.map((f) => f.id), view: () => ({ ...viewRef.current }), setView: (v) => { viewRef.current = v; sync(); },
      fitAll: () => { const r = rect(); viewRef.current = fit(frames, r.width, r.height, 90); sync(); },
      fitTo: (ids) => { const r = rect(); viewRef.current = fit(frames.filter((f) => ids.includes(f.id)), r.width, r.height, 110); sync(); }, visibleCount: () => visRef.current.size,
      edit: async (id, el, prop, value) => { const t0 = performance.now(); const r = await bridge(id)?.request({ t: 'edit', el, prop, value }); return { ok: !!r?.ok, ms: performance.now() - t0, before: r?.before ?? '' }; },
      get: async (id, el, prop) => (await bridge(id)?.request({ t: 'get', el, prop }))?.value,
      props: async (id, el, props) => (await bridge(id)?.request({ t: 'props', el, props }))?.values,
      tree: async (id) => (await bridge(id)?.request({ t: 'tree' }))?.tree ?? [],
      hit: async (id, x, y) => (await bridge(id)?.request({ t: 'hit', x, y }))?.id,
      outer: async (id, el) => (await bridge(id)?.request({ t: 'outer', el }))?.html ?? '',
      snapshot: async (id) => (await bridge(id)?.request({ t: 'snapshot' }))?.html ?? '',
      load: async (id, html) => !!(await bridge(id)?.request({ t: 'load', html }))?.ok,
      text: async (id, el, value) => !!(await bridge(id)?.request({ t: 'text', el, value }))?.ok,
      add: async (id, parent, html) => !!(await bridge(id)?.request({ t: 'add', el: parent, html }))?.ok,
      remove: async (id, el) => !!(await bridge(id)?.request({ t: 'remove', el }))?.ok,
    };
    onReadyRef.current?.(); // the hooks exist now: panels that read frames (layers) can fetch
    return () => { host.removeEventListener('wheel', onWheel); host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up); window.removeEventListener('message', onMessage); window.removeEventListener('resize', onResize); delete window.__swift; };
  }, [frames, bridges, sync]);
  // The selection outline: re-measured whenever the selection or the document changes (not on pan/zoom: it lives in world space).
  useEffect(() => {
    let alive = true; setSelRect(null); if (!selection) return;
    void bridges.get(selection.frameId)?.request({ t: 'rect', el: selection.el }).then((r) => { if (alive && r.ok && r.rect) setSelRect(r.rect); });
    return () => { alive = false; };
  }, [selection, revision, bridges]);
  const selFrame0 = selection ? frames.find((f) => f.id === selection.frameId) : undefined; selBoxRef.current = selFrame0 && selRect ? { x: selFrame0.x + selRect.x, y: selFrame0.y + selRect.y, w: selRect.w, h: selRect.h } : null;
  const selFrame = selection ? frames.find((f) => f.id === selection.frameId) : undefined;
  return (
    <div ref={hostRef} className="canvas" data-testid="canvas">
      <div ref={worldRef} className="world">
        {frames.map((f) => (
          <div key={f.id} className="fr" style={{ left: f.x, top: f.y, width: f.w, height: f.h, display: visible.has(f.id) ? 'block' : 'none' }}>
            <iframe ref={(el) => { if (el) iframes.current.set(f.id, el); else iframes.current.delete(f.id); }} title={f.title} sandbox="allow-scripts" {...(EXT_FRAME ? { src: EXT_FRAME, onLoad: () => { void bridges.get(f.id)?.request({ t: 'load', html: f.html }); } } : { srcDoc: frameDoc(f.html) })} width={f.w} height={f.h} style={{ border: 0, display: 'block', pointerEvents: 'none' }} />
            {painting?.has(f.id) && <div className="fr-busy" data-testid="frame-busy" aria-label="Claude is painting this take" />}
            {editing === f.id
              ? <input className="fr-label fr-edit" aria-label="Frame name" data-testid="frame-name" autoFocus defaultValue={f.title} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { onRename?.(f.id, e.currentTarget.value); setEditing(null); } else if (e.key === 'Escape') setEditing(null); }} onBlur={(e) => { if (editing === f.id) { onRename?.(f.id, e.currentTarget.value); setEditing(null); } }} />
              : <span className="fr-label" data-testid="frame-label" title="Double-click to rename" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={() => setEditing(f.id)}>{f.title}</span>}
          </div>
        ))}
        {selFrame && selRect && onResize && selection?.el !== selFrame.root && <div className="sel-h" data-testid="resize-handle" style={{ left: selFrame.x + selRect.x + selRect.w, top: selFrame.y + selRect.y + selRect.h }} />}
        {selFrame && selRect && <div className="sel" data-testid="sel" style={{ left: selFrame.x + selRect.x, top: selFrame.y + selRect.y, width: selRect.w, height: selRect.h }} />}
      </div>
    </div>
  );
}
