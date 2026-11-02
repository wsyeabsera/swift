import { useEffect, useState } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { Inspector, Layers } from './Panels';
import { Canvas, type Sel } from './canvas/Canvas';
import { makeFrames } from './canvas/fixtures';
import { connectHelper, type HelperState } from './helper';
const TOKEN = (import.meta.env.VITE_HELPER_TOKEN as string | undefined) ?? 'dev-token';
const LENSES = ['Design', 'Prototype', 'Motion', 'Effects', '3D', 'Critique', 'Diagram'] as const;
export function App() {
  const [helper, setHelper] = useState<HelperState>({ status: 'connecting' });
  const frames = useMemo(() => makeFrames(20), []);
  const [tier0, setTier0] = useState<string>('');
  const [selection, setSelection] = useState<Sel | null>(null); const [revision, setRevision] = useState(0);
  type Entry = { frameId: string; el: string; prop: string; before: string; after: string };
  const history = useRef<Entry[]>([]); const [edits, setEdits] = useState(0);
  const edit = useCallback(async (frameId: string, el: string, prop: string, value: string, record = true) => {
    const r = await window.__swift?.edit(frameId, el, prop, value); if (!r?.ok) return;
    if (record) { history.current.push({ frameId, el, prop, before: r.before, after: value }); setEdits(history.current.length); }
    setTier0(`Tier 0 · ${r.ms.toFixed(1)} ms`); setRevision((n) => n + 1);
  }, []);
  const undo = useCallback(async () => { const e = history.current.pop(); if (!e) return; setEdits(history.current.length); await edit(e.frameId, e.el, e.prop, e.before, false); }, [edit]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); void undo(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [undo]);
  const [lens, setLens] = useState<(typeof LENSES)[number]>('Design');
  useEffect(() => connectHelper(TOKEN, setHelper), []);
  const dot = helper.status === 'connected' ? 'ok' : helper.status === 'connecting' ? 'warn' : 'bad';
  return (
    <div className="kit-root" style={{ backgroundImage: 'url(./bg/lake.jpg)' }}>
      <header className="kit-top">
        <div className="gl isl" aria-label="Project">
          <span className="mark" aria-hidden>⚡</span>
          <span className="pj"><b>tvdash</b><span className="mono mu">idle-refresh</span></span>
        </div>
        <nav className="gl isl lens" aria-label="Lens">
          {LENSES.map((l) => (<button key={l} className={`rb seg${l === lens ? ' on' : ''}`} aria-pressed={l === lens} onClick={() => setLens(l)}>{l}</button>))}
        </nav>
        <div className="gl isl speed" role="status" aria-live="polite" data-testid="helper-status">
          <span className={`dot ${dot}`} aria-hidden />
          <span className="mono">{helper.status === 'connected' ? `helper · claude ${helper.claude ?? '?'}` : `helper · ${helper.status}`}</span>
        </div>
      </header>
      <Canvas frames={frames} selection={selection} onSelect={setSelection} revision={revision} onReady={() => setRevision((n) => n + 1)} />
      <Layers frameId={selection?.frameId ?? 'tv'} selection={selection} onSelect={setSelection} revision={revision} />
      <Inspector selection={selection} revision={revision} onEdit={(prop, value) => { if (selection) void edit(selection.frameId, selection.el, prop, value); }} />
      <footer className="gl isl tools" aria-label="Canvas tools">
        <button className="rb btn" onClick={() => window.__swift?.fitAll()}>Fit</button>
        <button className="rb btn" onClick={() => void edit('tv', 'clock', 'font-size', '280px')}>Clock bigger</button>
        <button className="rb btn" onClick={() => void undo()} disabled={edits === 0} data-testid="undo">Undo{edits ? ` (${edits})` : ''}</button>
        <span className="mono mu" data-testid="tier0">{tier0 || 'Tier 0 · ready'}</span>
      </footer>
    </div>
  );
}
