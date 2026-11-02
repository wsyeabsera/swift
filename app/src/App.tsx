import { useEffect, useState } from 'react';
import { useMemo } from 'react';
import { Canvas } from './canvas/Canvas';
import { makeFrames } from './canvas/fixtures';
import { connectHelper, type HelperState } from './helper';
const TOKEN = (import.meta.env.VITE_HELPER_TOKEN as string | undefined) ?? 'dev-token';
const LENSES = ['Design', 'Prototype', 'Motion', 'Effects', '3D', 'Critique', 'Diagram'] as const;
export function App() {
  const [helper, setHelper] = useState<HelperState>({ status: 'connecting' });
  const frames = useMemo(() => makeFrames(20), []);
  const [tier0, setTier0] = useState<string>('');
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
      <Canvas frames={frames} />
      <footer className="gl isl tools" aria-label="Canvas tools">
        <button className="rb btn" onClick={() => window.__swift?.fitAll()}>Fit</button>
        <button className="rb btn" onClick={async () => { const r = await window.__swift?.edit('tv', 'clock', 'font-size', '280px'); if (r) setTier0(`Tier 0 · ${r.ms.toFixed(1)} ms`); }}>Clock bigger</button>
        <span className="mono mu" data-testid="tier0">{tier0 || 'Tier 0 · ready'}</span>
      </footer>
    </div>
  );
}
