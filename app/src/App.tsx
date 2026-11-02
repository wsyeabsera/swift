import { useEffect, useState } from 'react';
import { useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { Appearance } from './Appearance';
import { ImportProject } from './ImportProject';
import { computeTheme, loadTheme, sanitize, saveTheme, backdropThumb, type ThemeChoice } from './theme';
import { Inspector, Layers } from './Panels';
import { Canvas, liveApi, type Sel } from './canvas/Canvas';
import { blankFrames, makeFrames, type FrameDef } from './canvas/fixtures';
import { zoomAt } from './canvas/viewport';
import { duplicateFrame, duplicateId } from './canvas/frames';
import { clearDoc, loadDoc, nextSparkN, parseDoc, saveDoc } from './doc';
import { connectHelper, type HelperConnection, type HelperState } from './helper';
import { runSayRepairing } from './say/say';
import { loadBrand, saveBrand } from './brand';
import { activeProject, addProject, loadRegistry, saveRegistry, switchProject, DEFAULT_PROJECT, type Registry } from './projects';
import { localEdits } from './say/local';
import { canSpark, discardTakes, isTake, keepTake, runSpark } from './say/spark';
const TOKEN = (import.meta.env.VITE_HELPER_TOKEN as string | undefined) ?? 'dev-token';
const LENSES = ['Design', 'Prototype', 'Motion', 'Effects', '3D', 'Critique', 'Diagram'] as const;
export function App() {
  const [helper, setHelper] = useState<HelperState>({ status: 'connecting' }); const conn = useRef<HelperConnection | null>(null);
  const [sayText, setSayText] = useState(''); const [pendingAsk, setPendingAsk] = useState<{ question: string; original: string } | null>(null); const [saying, setSaying] = useState(false); const [sayStatus, setSayStatus] = useState('');
  const [reg] = useState<Registry>(() => loadRegistry()); const project = activeProject(reg);
  const hadLocal = useRef(loadDoc(undefined, project.id) !== null); const [ready, setReady] = useState(hadLocal.current); const [epoch, setEpoch] = useState(0);
  const [frames, setFrames] = useState<FrameDef[]>(() => loadDoc(undefined, project.id) ?? (project.id === DEFAULT_PROJECT.id ? makeFrames(20) : blankFrames())); const [saveStatus, setSaveStatus] = useState('');
  const [brand, setBrand] = useState<Record<string, string>>(() => loadBrand(undefined, project.id));
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
    const gate = canSpark(frames, 4); if (!gate.ok) { setSparkStatus(gate.reason); return; }
    setSparking(true); setSparkStatus('Sparking 4 directions…'); const ac = new AbortController(); sparkAbort.current = ac;
    const r = await runSpark({ api: liveApi, send: c.say, base, n: 4, nextId: () => `${base.id}-t${++sparkN.current}`, addFrames: (f) => setFrames((e) => [...e, ...f]), signal: ac.signal, tokens: brand }); sparkAbort.current = null;
    const ok = r.takes.filter((t) => t.result.applied.length > 0).length; const err = r.takes.find((t) => t.result.error)?.result.error; const rej = r.takes.reduce((n, t) => n + t.result.rejected.length, 0); setSparkStatus(`${r.takes.length} takes · ${ok} changed${r.firstPaintMs !== null ? ` · first paint ${r.firstPaintMs.toFixed(0)} ms` : ''} · ${(r.totalMs / 1000).toFixed(1)} s${rej ? ` · ${rej} rejected` : ''}${err ? ` · ${err}` : ''}`); setSparking(false);
  }, [frames, selection, sparking, brand]);
  const say = useCallback(async () => {
    const text = sayText.trim(); const c = conn.current; if (!text || !window.__swift || !c || saying) return;
    if (selection && !pendingAsk && window.__swift) { // local tier: unambiguous requests on the selection never reach Claude
      const t0 = performance.now(); const sel = selection; const edits = await localEdits(text, { get: (p) => window.__swift!.get(sel.frameId, sel.el, p) });
      if (edits) { for (const e of edits) await edit(sel.frameId, sel.el, e.prop, e.value); setSayText(''); setSayStatus(`Local · ${edits.map((e) => `${e.prop}: ${e.value}`).join(', ')} · ${(performance.now() - t0).toFixed(0)} ms`); return; }
    }
    const frameId = selection?.frameId ?? 'tv'; const root = frames.find((f) => f.id === frameId)?.root ?? 'tv'; setSaying(true); setSayStatus('Saying…');
    const base = pendingAsk ? `${pendingAsk.original}\n\nYou asked: "${pendingAsk.question}". My answer: ${text}` : text; setPendingAsk(null);
    const r = await runSayRepairing({ api: liveApi, send: c.say, frameId, root, request: selection ? `${base} (the selected element is #${selection.el})` : base, tokens: brand });
    if (r.asked[0] && r.applied.length === 0) setPendingAsk({ question: r.asked[0], original: pendingAsk ? pendingAsk.original : text }); setSayText('');
    if (r.applied.length > 0) { history.current.push({ kind: 'say', frameId, snapshot: r.snapshot }); setEdits(history.current.length); }
    setSayStatus(r.error && r.applied.length === 0 ? `Say failed: ${r.error}` : `${r.applied.length} applied${r.repaired ? ` · ${r.repaired} repaired` : ''}${r.rejected.length ? ` · ${r.rejected.length} rejected` : ''}${r.firstMs !== null ? ` · first change ${r.firstMs.toFixed(0)} ms` : ''} · ${(r.totalMs / 1000).toFixed(1)} s${r.asked[0] ? ` · Claude asks: ${r.asked[0]}` : ''}`);
    setRevision((n) => n + 1); setSaying(false);
  }, [sayText, saying, selection, frames, pendingAsk, edit, brand]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); void undo(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [undo]);
  // Autosave: after the document changes settle, snapshot every frame (current HTML) and store the design; a failure is shown, not swallowed.
  const persist = useCallback(async (): Promise<string | null> => {
    if (!window.__swift || !ready) return null; // not before the helper copy had its chance to restore (else fresh fixtures would overwrite it)
    try {
      const snaps = await Promise.all(frames.map(async (f) => ({ ...f, html: (await window.__swift!.snapshot(f.id)) || f.html }))); const err = saveDoc(snaps, undefined, project.id);
      const backup = err ? null : await conn.current?.storePut(project.id, JSON.stringify({ frames: snaps }));
      setSaveStatus(err ? `not saved: ${err}` : backup && !backup.ok && backup.error !== 'helper offline' ? `saved · backup failed: ${backup.error}` : 'saved'); return err; } catch (e) { const m = e instanceof Error ? e.message : 'error'; setSaveStatus(`not saved: ${m}`); return m; }
  }, [frames, project.id, ready]);
  useEffect(() => { const t = setTimeout(() => void persist(), 1000); return () => clearTimeout(t); }, [persist, revision]);
  // First connect without a local copy (cleared browser data, new profile): restore the design from the helper's project file.
  useEffect(() => {
    if (ready || helper.status === 'connecting') return; if (helper.status === 'offline') { setReady(true); return; }
    let alive = true;
    void conn.current?.storeGet(project.id).then((r) => {
      if (!alive) return;
      if (!r.ok) setSayStatus(`Backup unreadable: ${r.error}`);
      else if (r.data) { let f: FrameDef[] | null = null; try { f = parseDoc(JSON.parse(r.data)); } catch { f = null; } if (f) { setFrames(f); sparkN.current = nextSparkN(f); setEpoch((n) => n + 1); setSayStatus('Restored from the helper'); } else setSayStatus('Backup is corrupt: starting fresh'); }
      setReady(true);
    });
    return () => { alive = false; };
  }, [helper.status, ready, project.id]);
  // Switching: flush the current design first (a failed save stops the switch), then store the registry and reload into the other project.
  const goTo = useCallback(async (next: Registry | null) => { if (!next) { setSayStatus('Could not create a project from that name'); return; } const err = await persist(); if (err) { setSayStatus(`Not switching: ${err}`); return; } const e2 = saveRegistry(next); if (e2) { setSayStatus(`Not switching: ${e2}`); return; } location.reload(); }, [persist]);
  const takeCount = useMemo(() => frames.filter(isTake).length, [frames]); const selIsTake = !!selection && frames.some((f) => f.id === selection.frameId && isTake(f));
  const discard = useCallback(() => { const gone = new Set(frames.filter(isTake).map((f) => f.id)); history.current = history.current.filter((e) => !gone.has(e.frameId)); setEdits(history.current.length); if (selection && gone.has(selection.frameId)) setSelection(null); setFrames(discardTakes); setSparkStatus(`${gone.size} takes discarded`); }, [frames, selection]);
  const resetDesign = useCallback(() => { clearDoc(undefined, project.id); location.reload(); }, [project.id]);
  // ⌘D duplicates the selected frame (its current HTML), then selects nothing so the copy can be picked by clicking.
  const duplicate = useCallback(async () => {
    const base = frames.find((f) => f.id === (selection?.frameId ?? '')); if (!base || !window.__swift) return;
    const html = await window.__swift.snapshot(base.id); if (!html) { setSayStatus('Could not duplicate: frame not ready'); return; }
    const copy = duplicateFrame(frames, base, duplicateId(frames, base.id), html); setFrames((f) => [...f, copy]); setSayStatus(`Duplicated ${base.title}`);
    setTimeout(() => window.__swift?.fitTo([copy.id]), 150);
  }, [frames, selection]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); void duplicate(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [duplicate]);
  // Canvas keys: ⌘0 fit all, ⌘1 actual size (around the centre), Escape clears the selection (popovers close first, see above).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target; if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return; const api = window.__swift; if (!api) return;
      if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); api.fitAll(); }
      else if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); const r = document.querySelector('[data-testid=canvas]')?.getBoundingClientRect(); const v = api.view(); if (r) api.setView(zoomAt(v, r.width / 2, r.height / 2, 1 / v.s)); }
      else if (e.key === 'Escape' && !importOpen && !appearanceOpen && selection) setSelection(null);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [selection, importOpen, appearanceOpen]);
  // Delete / Backspace removes the selected element (never a frame root); one snapshot makes it one undo step.
  const removeSelected = useCallback(async () => {
    if (!selection || !window.__swift) return; const f = frames.find((x) => x.id === selection.frameId); if (!f || f.root === selection.el) return;
    const snapshot = await window.__swift.snapshot(selection.frameId); if (!(await window.__swift.remove(selection.frameId, selection.el))) { setSayStatus(`Could not remove #${selection.el}`); return; }
    history.current.push({ kind: 'say', frameId: selection.frameId, snapshot }); setEdits(history.current.length); setSelection(null); setRevision((n) => n + 1); setSayStatus(`Removed #${selection.el}`);
  }, [selection, frames]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.key !== 'Delete' && e.key !== 'Backspace') || e.metaKey || e.ctrlKey || e.altKey) return; const t = e.target; if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return; e.preventDefault(); void removeSelected(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [removeSelected]);
  const [lens, setLens] = useState<(typeof LENSES)[number]>('Design');
  useEffect(() => { const c = connectHelper(TOKEN, setHelper); conn.current = c; return c.close; }, []);
  const dot = helper.status === 'connected' ? 'ok' : helper.status === 'connecting' ? 'warn' : 'bad';
  return (
    <div className={`kit-root m-${mode}`} style={vars as CSSProperties}>
      <header className="kit-top">
        <div className="gl isl" aria-label="Project">
          <span className="mark" aria-hidden>⚡</span>
          <button ref={pjRef} className="rb pj pjbtn" aria-haspopup="dialog" aria-expanded={importOpen} data-testid="project-button" onClick={() => setImportOpen((o) => !o)}><b>{project.name}</b><span className="mono mu">{frames.length} frames</span></button>
          <button ref={swatchRef} className="rb swatch" aria-label="Appearance" aria-haspopup="dialog" aria-expanded={appearanceOpen} data-testid="appearance-button" style={{ backgroundImage: backdropThumb(theme.bd) }} onClick={() => setAppearanceOpen((o) => !o)} />
        </div>
        {importOpen && conn.current && <ImportProject scan={conn.current.scan} projects={reg.list} active={project.id} onSwitch={(id) => void goTo(switchProject(reg, id))} onCreate={(name, t) => { const next = addProject(reg, name); if (next) saveBrand(t, undefined, next.active); void goTo(next); }} using={Object.keys(brand).length} onUse={(t) => { const err = saveBrand(t, undefined, project.id); setBrand(t); if (err) setSayStatus(`Brand not saved: ${err}`); }} onClose={() => { setImportOpen(false); pjRef.current?.focus(); }} />}
        {appearanceOpen && <Appearance theme={theme} onChange={(p) => setTheme((t) => sanitize({ ...t, ...p }))} onClose={closeAppearance} />}
        <nav className="gl isl lens" aria-label="Lens">
          {LENSES.map((l) => (<button key={l} className={`rb seg${l === lens ? ' on' : ''}`} aria-pressed={l === lens} onClick={() => setLens(l)}>{l}</button>))}
        </nav>
        <div className="gl isl speed" role="status" aria-live="polite" data-testid="helper-status">
          <span className={`dot ${dot}`} aria-hidden />
          <span className="mono">{helper.status === 'connected' ? `helper · claude ${helper.claude ?? '?'}` : `helper · ${helper.status}`}</span>
        </div>
      </header>
      <Canvas key={epoch} frames={frames} selection={selection} onSelect={setSelection} revision={revision} onReady={() => setRevision((n) => n + 1)} />
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
