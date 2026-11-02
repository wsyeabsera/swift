import { useEffect, useState } from 'react';
import { useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { Appearance } from './Appearance';
import { computeTheme, loadTheme, sanitize, saveTheme, backdropThumb, type ThemeChoice } from './theme';
import { Inspector, Layers } from './Panels';
import { Canvas, type Sel } from './canvas/Canvas';
import { makeFrames } from './canvas/fixtures';
import { connectHelper, type HelperConnection, type HelperState } from './helper';
import { runSay } from './say/say';
const TOKEN = (import.meta.env.VITE_HELPER_TOKEN as string | undefined) ?? 'dev-token';
const LENSES = ['Design', 'Prototype', 'Motion', 'Effects', '3D', 'Critique', 'Diagram'] as const;
export function App() {
  const [helper, setHelper] = useState<HelperState>({ status: 'connecting' }); const conn = useRef<HelperConnection | null>(null);
  const [sayText, setSayText] = useState(''); const [saying, setSaying] = useState(false); const [sayStatus, setSayStatus] = useState('');
  const frames = useMemo(() => makeFrames(20), []);
  const [theme, setTheme] = useState<ThemeChoice>(() => loadTheme()); const [appearanceOpen, setAppearanceOpen] = useState(false); const swatchRef = useRef<HTMLButtonElement>(null);
  const { mode, vars } = useMemo(() => computeTheme(theme), [theme]);
  useEffect(() => saveTheme(theme), [theme]);
  useEffect(() => { (window as Window & { __theme?: unknown }).__theme = { set: (p: Partial<ThemeChoice>) => setTheme((t) => sanitize({ ...t, ...p })), get: () => theme }; }, [theme]);
  const closeAppearance = useCallback(() => { setAppearanceOpen(false); swatchRef.current?.focus(); }, []);
  const [tier0, setTier0] = useState<string>('');
  const [selection, setSelection] = useState<Sel | null>(null); const [revision, setRevision] = useState(0);
  type Entry = { kind: 'edit'; frameId: string; el: string; prop: string; before: string; after: string } | { kind: 'say'; frameId: string; snapshot: string };
  const history = useRef<Entry[]>([]); const [edits, setEdits] = useState(0);
  const edit = useCallback(async (frameId: string, el: string, prop: string, value: string, record = true) => {
    const r = await window.__swift?.edit(frameId, el, prop, value); if (!r?.ok) return;
    if (record) { history.current.push({ kind: 'edit', frameId, el, prop, before: r.before, after: value }); setEdits(history.current.length); }
    setTier0(`Tier 0 · ${r.ms.toFixed(1)} ms`); setRevision((n) => n + 1);
  }, []);
  const undo = useCallback(async () => { const e = history.current.pop(); if (!e) return; setEdits(history.current.length); if (e.kind === 'say') { await window.__swift?.load(e.frameId, e.snapshot); setRevision((n) => n + 1); setSayStatus('Say undone'); } else await edit(e.frameId, e.el, e.prop, e.before, false); }, [edit]);
  const say = useCallback(async () => {
    const text = sayText.trim(); const api = window.__swift; const c = conn.current; if (!text || !api || !c || saying) return;
    const frameId = selection?.frameId ?? 'tv'; const root = frames.find((f) => f.id === frameId)?.root ?? 'tv'; setSaying(true); setSayStatus('Saying…');
    const r = await runSay({ api, send: c.say, frameId, root, request: selection ? `${text} (the selected element is #${selection.el})` : text });
    if (r.applied.length > 0) { history.current.push({ kind: 'say', frameId, snapshot: r.snapshot }); setEdits(history.current.length); }
    setSayStatus(r.error && r.applied.length === 0 ? `Say failed: ${r.error}` : `${r.applied.length} applied${r.rejected.length ? ` · ${r.rejected.length} rejected` : ''}${r.firstMs !== null ? ` · first change ${r.firstMs.toFixed(0)} ms` : ''} · ${(r.totalMs / 1000).toFixed(1)} s${r.asked[0] ? ` · Claude asks: ${r.asked[0]}` : ''}`);
    setRevision((n) => n + 1); setSaying(false);
  }, [sayText, saying, selection, frames]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); void undo(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [undo]);
  const [lens, setLens] = useState<(typeof LENSES)[number]>('Design');
  useEffect(() => { const c = connectHelper(TOKEN, setHelper); conn.current = c; return c.close; }, []);
  const dot = helper.status === 'connected' ? 'ok' : helper.status === 'connecting' ? 'warn' : 'bad';
  return (
    <div className={`kit-root m-${mode}`} style={vars as CSSProperties} onKeyDown={(e) => { if (e.key === 'Escape' && appearanceOpen) closeAppearance(); }}>
      <header className="kit-top">
        <div className="gl isl" aria-label="Project">
          <span className="mark" aria-hidden>⚡</span>
          <span className="pj"><b>tvdash</b><span className="mono mu">idle-refresh</span></span>
          <button ref={swatchRef} className="rb swatch" aria-label="Appearance" aria-haspopup="dialog" aria-expanded={appearanceOpen} data-testid="appearance-button" style={{ backgroundImage: backdropThumb(theme.bd) }} onClick={() => setAppearanceOpen((o) => !o)} />
        </div>
        {appearanceOpen && <Appearance theme={theme} onChange={(p) => setTheme((t) => sanitize({ ...t, ...p }))} onClose={closeAppearance} />}
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
      <form className="gl isl say" aria-label="Say" onSubmit={(e) => { e.preventDefault(); void say(); }}>
        <input data-testid="say-input" aria-label="Say what to change" placeholder={selection ? `Say what to change about #${selection.el}…` : 'Say what to change…'} value={sayText} onChange={(e) => setSayText(e.target.value)} onFocus={() => conn.current?.prewarm()} disabled={saying} />
        <button type="submit" className="rb btn say-go" data-testid="say-button" disabled={saying || !sayText.trim()}>Say</button>
        <span className="mono mu say-status" data-testid="say-status" role="status">{sayStatus}</span>
      </form>
      <footer className="gl isl tools" aria-label="Canvas tools">
        <button className="rb btn" onClick={() => window.__swift?.fitAll()}>Fit</button>
        <button className="rb btn" onClick={() => void edit('tv', 'clock', 'font-size', '280px')}>Clock bigger</button>
        <button className="rb btn" onClick={() => void undo()} disabled={edits === 0} data-testid="undo">Undo{edits ? ` (${edits})` : ''}</button>
        <span className="mono mu" data-testid="tier0">{tier0 || 'Tier 0 · ready'}</span>
      </footer>
    </div>
  );
}
