import { useEffect, useState } from 'react';
import { useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { Appearance } from './Appearance';
import { ImportProject } from './ImportProject';
import { computeTheme, loadTheme, sanitize, saveTheme, backdropThumb, type ThemeChoice } from './theme';
import { Inspector, Layers } from './Panels';
import { Canvas, liveApi, type Sel } from './canvas/Canvas';
import { makeFrames, type FrameDef } from './canvas/fixtures';
import { clearDoc, loadDoc, nextSparkN, saveDoc } from './doc';
import { connectHelper, type HelperConnection, type HelperState } from './helper';
import { runSayRepairing } from './say/say';
import { discardTakes, isTake, keepTake, runSpark } from './say/spark';
const TOKEN = (import.meta.env.VITE_HELPER_TOKEN as string | undefined) ?? 'dev-token';
const LENSES = ['Design', 'Prototype', 'Motion', 'Effects', '3D', 'Critique', 'Diagram'] as const;
export function App() {
  const [helper, setHelper] = useState<HelperState>({ status: 'connecting' }); const conn = useRef<HelperConnection | null>(null);
  const [sayText, setSayText] = useState(''); const [pendingAsk, setPendingAsk] = useState<{ question: string; original: string } | null>(null); const [saying, setSaying] = useState(false); const [sayStatus, setSayStatus] = useState('');
  const [frames, setFrames] = useState<FrameDef[]>(() => loadDoc() ?? makeFrames(20)); const [saveStatus, setSaveStatus] = useState('');
  const sparkN = useRef(nextSparkN(frames)); const [sparkStatus, setSparkStatus] = useState(''); const sparkAbort = useRef<AbortController | null>(null); const [sparking, setSparking] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>(() => loadTheme()); const [appearanceOpen, setAppearanceOpen] = useState(false); const [importOpen, setImportOpen] = useState(false); const pjRef = useRef<HTMLButtonElement>(null); const swatchRef = useRef<HTMLButtonElement>(null);
  const { mode, vars } = useMemo(() => computeTheme(theme), [theme]);
  useEffect(() => saveTheme(theme), [theme]);
  useEffect(() => { (window as Window & { __theme?: unknown }).__theme = { set: (p: Partial<ThemeChoice>) => setTheme((t) => sanitize({ ...t, ...p })), get: () => theme }; }, [theme]);
  // Escape closes an open popover with focus ANYWHERE (a focused button that becomes disabled drops focus to <body>, outside any element handler); focus returns to its trigger.
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (importOpen) { setImportOpen(false); pjRef.current?.focus(); } else if (appearanceOpen) { setAppearanceOpen(false); swatchRef.current?.focus(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [importOpen, appearanceOpen]);
  const sayRef = useRef<HTMLInputElement>(null);
  // ⌘K / Ctrl+K: jump to the Say input from anywhere (also closes an open popover so the keys are not swallowed).
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setImportOpen(false); setAppearanceOpen(false); sayRef.current?.focus(); sayRef.current?.select(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
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
  const spark = useCallback(async () => {
    const c = conn.current; const base = frames.find((f) => f.id === (selection?.frameId ?? 'tv')); if (!window.__swift || !c || !base || sparking) return;
    setSparking(true); setSparkStatus('Sparking 4 directions…'); const ac = new AbortController(); sparkAbort.current = ac;
    const r = await runSpark({ api: liveApi, send: c.say, base, n: 4, nextId: () => `${base.id}-t${++sparkN.current}`, addFrames: (f) => setFrames((e) => [...e, ...f]), signal: ac.signal }); sparkAbort.current = null;
    const ok = r.takes.filter((t) => t.result.applied.length > 0).length; const err = r.takes.find((t) => t.result.error)?.result.error; const rej = r.takes.reduce((n, t) => n + t.result.rejected.length, 0); setSparkStatus(`${r.takes.length} takes · ${ok} changed${r.firstPaintMs !== null ? ` · first paint ${r.firstPaintMs.toFixed(0)} ms` : ''} · ${(r.totalMs / 1000).toFixed(1)} s${rej ? ` · ${rej} rejected` : ''}${err ? ` · ${err}` : ''}`); setSparking(false);
  }, [frames, selection, sparking]);
  const say = useCallback(async () => {
    const text = sayText.trim(); const c = conn.current; if (!text || !window.__swift || !c || saying) return;
    const frameId = selection?.frameId ?? 'tv'; const root = frames.find((f) => f.id === frameId)?.root ?? 'tv'; setSaying(true); setSayStatus('Saying…');
    const base = pendingAsk ? `${pendingAsk.original}\n\nYou asked: "${pendingAsk.question}". My answer: ${text}` : text; setPendingAsk(null);
    const r = await runSayRepairing({ api: liveApi, send: c.say, frameId, root, request: selection ? `${base} (the selected element is #${selection.el})` : base });
    if (r.asked[0] && r.applied.length === 0) setPendingAsk({ question: r.asked[0], original: pendingAsk ? pendingAsk.original : text }); setSayText('');
    if (r.applied.length > 0) { history.current.push({ kind: 'say', frameId, snapshot: r.snapshot }); setEdits(history.current.length); }
    setSayStatus(r.error && r.applied.length === 0 ? `Say failed: ${r.error}` : `${r.applied.length} applied${r.repaired ? ` · ${r.repaired} repaired` : ''}${r.rejected.length ? ` · ${r.rejected.length} rejected` : ''}${r.firstMs !== null ? ` · first change ${r.firstMs.toFixed(0)} ms` : ''} · ${(r.totalMs / 1000).toFixed(1)} s${r.asked[0] ? ` · Claude asks: ${r.asked[0]}` : ''}`);
    setRevision((n) => n + 1); setSaying(false);
  }, [sayText, saying, selection, frames, pendingAsk]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); void undo(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [undo]);
  // Autosave: after the document changes settle, snapshot every frame (current HTML) and store the design; a failure is shown, not swallowed.
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!window.__swift) return;
      try { const snaps = await Promise.all(frames.map(async (f) => ({ ...f, html: (await window.__swift!.snapshot(f.id)) || f.html }))); const err = saveDoc(snaps); setSaveStatus(err ? `not saved: ${err}` : 'saved'); } catch (e) { setSaveStatus(`not saved: ${e instanceof Error ? e.message : 'error'}`); }
    }, 1000);
    return () => clearTimeout(t);
  }, [frames, revision]);
  const takeCount = useMemo(() => frames.filter(isTake).length, [frames]); const selIsTake = !!selection && frames.some((f) => f.id === selection.frameId && isTake(f));
  const discard = useCallback(() => { const gone = new Set(frames.filter(isTake).map((f) => f.id)); history.current = history.current.filter((e) => !gone.has(e.frameId)); setEdits(history.current.length); if (selection && gone.has(selection.frameId)) setSelection(null); setFrames(discardTakes); setSparkStatus(`${gone.size} takes discarded`); }, [frames, selection]);
  const resetDesign = useCallback(() => { clearDoc(); location.reload(); }, []);
  const [lens, setLens] = useState<(typeof LENSES)[number]>('Design');
  useEffect(() => { const c = connectHelper(TOKEN, setHelper); conn.current = c; return c.close; }, []);
  const dot = helper.status === 'connected' ? 'ok' : helper.status === 'connecting' ? 'warn' : 'bad';
  return (
    <div className={`kit-root m-${mode}`} style={vars as CSSProperties}>
      <header className="kit-top">
        <div className="gl isl" aria-label="Project">
          <span className="mark" aria-hidden>⚡</span>
          <button ref={pjRef} className="rb pj pjbtn" aria-haspopup="dialog" aria-expanded={importOpen} data-testid="project-button" onClick={() => setImportOpen((o) => !o)}><b>tvdash</b><span className="mono mu">idle-refresh</span></button>
          <button ref={swatchRef} className="rb swatch" aria-label="Appearance" aria-haspopup="dialog" aria-expanded={appearanceOpen} data-testid="appearance-button" style={{ backgroundImage: backdropThumb(theme.bd) }} onClick={() => setAppearanceOpen((o) => !o)} />
        </div>
        {importOpen && conn.current && <ImportProject scan={conn.current.scan} onClose={() => { setImportOpen(false); pjRef.current?.focus(); }} />}
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
        <input ref={sayRef} data-testid="say-input" aria-label="Say what to change" title="⌘K" placeholder={pendingAsk ? `Claude asks: ${pendingAsk.question}` : selection ? `Say what to change about #${selection.el}…` : 'Say what to change…'} value={sayText} onChange={(e) => setSayText(e.target.value)} onFocus={() => conn.current?.prewarm()} disabled={saying} />
        <button type="submit" className="rb btn say-go" data-testid="say-button" disabled={saying || !sayText.trim()}>Say</button>
        <span className="mono mu say-status" data-testid="say-status" role="status">{sayStatus}</span>
      </form>
      <footer className="gl isl tools" aria-label="Canvas tools">
        <button className="rb btn" onClick={() => window.__swift?.fitAll()}>Fit</button>
        <button className="rb btn" onClick={() => void edit('tv', 'clock', 'font-size', '280px')}>Clock bigger</button>
        {sparking ? <button className="rb btn" onClick={() => sparkAbort.current?.abort()} data-testid="spark-cancel">Cancel Spark</button> : <button className="rb btn" onClick={() => void spark()} data-testid="spark-button">Spark ×4</button>}
        <button className="rb btn" onClick={() => selection && setFrames((f) => keepTake(f, selection.frameId))} disabled={!selIsTake} data-testid="keep-take">Keep take</button>
        <button className="rb btn" onClick={discard} disabled={takeCount === 0} data-testid="discard-takes">Discard takes{takeCount ? ` (${takeCount})` : ''}</button>
        <button className="rb btn" onClick={resetDesign} data-testid="reset">Reset</button>
        <button className="rb btn" onClick={() => void undo()} disabled={edits === 0} data-testid="undo">Undo{edits ? ` (${edits})` : ''}</button>
        <span className="mono mu" data-testid="tier0">{tier0 || 'Tier 0 · ready'}</span>
        {saveStatus && <span className="mono mu" data-testid="save-status" role="status">{saveStatus}</span>}
        {sparkStatus && <span className="mono mu" data-testid="spark-status" role="status">{sparkStatus}</span>}
      </footer>
    </div>
  );
}
