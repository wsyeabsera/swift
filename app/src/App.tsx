import { useEffect, useState } from 'react';
import { connectHelper, type HelperState } from './helper';
const TOKEN = (import.meta.env.VITE_HELPER_TOKEN as string | undefined) ?? 'dev-token';
const LENSES = ['Design', 'Prototype', 'Motion', 'Effects', '3D', 'Critique', 'Diagram'] as const;
export function App() {
  const [helper, setHelper] = useState<HelperState>({ status: 'connecting' });
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
      <main className="stage"><div className="gl card"><h1>Swift Canvas</h1><p className="mu">Empty canvas. The shell, the Liquid Glass chrome and the helper link are live; frames, Say and Spark come next.</p></div></main>
    </div>
  );
}
