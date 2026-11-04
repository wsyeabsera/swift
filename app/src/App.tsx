import { useEffect, useState } from 'react';
import { useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { Appearance } from './Appearance';
import { ImportProject } from './ImportProject';
import { Shortcuts } from './Shortcuts';
import { MAX_FILE_BYTES, parseProjectFile, projectFileName, serializeProject } from './projectFile';
import { computeTheme, loadTheme, sanitize, saveTheme, backdropThumb, type ThemeChoice } from './theme';
import { Inspector, Layers } from './Panels';
import { Canvas, liveApi, type Sel } from './canvas/Canvas';
import { blankFrames, makeFrames, type FrameDef } from './canvas/fixtures';
import { zoomAt } from './canvas/viewport';
import { moveEdits, moveStart, type MoveStart, nudge, resizedSize } from './canvas/nudge';
import { firstChild, parentOf } from './canvas/tree';
import { compareSet, diffSigs, mixEdits, originalId, type Change } from './canvas/compare';
import { exportDoc, exportName } from './canvas/exportHtml';
import { componentName, frameToTsx } from './canvas/exportReact';
import type { RepoEntry, RepoFile } from './helper';
import { starterFrames } from './canvas/starter';
import { retheme } from './retheme';
import { DEFAULT_CREW } from './crew/defaults';
import { loadCrew, type CrewFile } from './crew/sheet';
import { loadCrewFiles, saveCrewFiles } from './crew/store';
import { dtcgString, fromDtcg, toDtcg } from './dtcg';
import { addRef, dominantColors, loadMoodboard, moodboardPrompt, parseTypeCue, removeRef, saveMoodboard, setNote, TYPE_PROMPT, TYPE_SYSTEM, type Moodboard } from './moodboard';
import { isDue, parseProposals, refinePrompt, type Proposal } from './refine';
import * as L from './oplog';
import type { Log, Op } from './oplog';
import { addUsage, appendUsage, estimateSpark, loadUsage, saveUsage, summarizeUsage, tokensShort, type Usage } from './usage';
import { addRecord, loadRecords, markUndone, saveRecords, summarize, flags, type Rec } from './telemetry';
import { filterItems, origins, removeItem, addItem, loadLibrary, saveLibrary, uniquifyIds, type LibItem } from './library';
import { pageTokens } from './canvas/capture';
import { frameSizeFor, readScreenshot, rebuildScreenshot } from './canvas/screenshot';
import type { CaptureOutcome } from './ImportProject';
import type { PoolStatus } from './helper';
import { capturedFrame, duplicateFrame, duplicateId, newFrame, PRESETS, renameFrame, surfaceOf, type PresetKey } from './canvas/frames';
import { clearDoc, fitLog, loadDoc, loadLog, nextSparkN, parseDoc, parseLog, saveDoc } from './doc';
import { connectHelper, type HelperConnection, type HelperState } from './helper';
import { handleMcp, type McpEnv } from './mcp';
import { runSayRepairing } from './say/say';
import { compareKits, isColorValue, kitColors, loadBrand, replaceColor, saveBrand, shareToken, toBrandTokens } from './brand';
import { activeProject, addProject, uniqueName, loadRegistry, saveRegistry, switchProject, DEFAULT_PROJECT, type Registry } from './projects';
import { altKey, count as altCount, cycle as altCycle, keepOne, saveVariant, type Alts } from './alternates';
import { addLink, follow, loadLinks, pruneLinks, removeLink, saveLinks, type Link } from './proto';
import { EASES, emptyTimeline, loadTimeline, sample as motionSample, saveTimeline, setEase as motionEase, setKey as motionKey, type Ease, type Timeline } from './motion';
import { canMerge, merge as mergeBranch, type Choice, type Conflict } from './merge';
import { pushHistory, step } from './say/history';
import { auditFacts, type Finding } from './canvas/audit';
import { CRITIQUE_SYSTEM, critiquePrompt, parseCritique } from './canvas/critique';
import { fxHtml, fxId, FX_PRESETS, meter as fxMeter, parseFx, suggest as fxSuggest, type Device, type Effect } from './effects';
import { localEdits, propTokenRequest, themeRequest, easeRequest, tokenRequest } from './say/local';
import { suggestions, type SuggestProps } from './say/suggest';
import { canSpark, DIRECTIONS, discardTakes, isTake, keepTake, runSpark } from './say/spark';
import { buildSystemPrompt } from './say/prompt';
const TOKEN = (import.meta.env.VITE_HELPER_TOKEN as string | undefined) ?? 'dev-token';
const LENSES = ['Design', 'Prototype', 'Motion', 'Effects', '3D', 'Critique', 'Diagram'] as const;
export function App() {
  const [helper, setHelper] = useState<HelperState>({ status: 'connecting' }); const conn = useRef<HelperConnection | null>(null);
  const [sayText, setSayText] = useState(''); const [pendingAsk, setPendingAsk] = useState<{ question: string; original: string } | null>(null); const [saying, setSaying] = useState(false); const [sayStatus, setSayStatus] = useState('');
  const [reg] = useState<Registry>(() => loadRegistry()); const project = activeProject(reg);
  const hadLocal = useRef(loadDoc(undefined, project.id) !== null); const [ready, setReady] = useState(hadLocal.current); const [epoch, setEpoch] = useState(0);
  const [frames, setFrames] = useState<FrameDef[]>(() => loadDoc(undefined, project.id) ?? (project.id === DEFAULT_PROJECT.id ? makeFrames(20) : blankFrames())); const [saveStatus, setSaveStatus] = useState('');
  // Pulse telemetry (local only): one record per local edit / Say / Spark; an undo marks its record, a redo unmarks it.
  const [recs, setRecs] = useState<Rec[]>(() => loadRecords()); const recsRef = useRef(recs);
  const track = useCallback((r: Omit<Rec, 'id' | 'undone'>) => { const x = addRecord(recsRef.current, r); recsRef.current = x.list; setRecs(x.list); saveRecords(x.list); return x.id; }, []);
  const markRec = useCallback((id: number | undefined, undone: boolean) => { if (id === undefined) return; recsRef.current = markUndone(recsRef.current, id, undone); setRecs(recsRef.current); saveRecords(recsRef.current); }, []);
  // Moodboard: reference images (downscaled thumbnail + dominant colours) steer Spark directions as text only.
  const [mood, setMood] = useState<Moodboard>(() => loadMoodboard(project.id)); const moodFile = useRef<HTMLInputElement>(null);
  const changeMood = useCallback((next: Moodboard) => { setMood(next); const err = saveMoodboard(project.id, next); if (err) setSayStatus(`Moodboard kept for now, not stored: ${err}`); }, [project.id]);
  const [crewFiles, setCrewFilesState] = useState<CrewFile[]>(() => loadCrewFiles(project.id)); const crewSet = useMemo(() => loadCrew(DEFAULT_CREW, crewFiles), [crewFiles]);
  const loadCrewFolder = async () => { // the project's `.swift-canvas/crew/*.md` from a folder the user picks; a bad sheet is reported by file name and skipped, the rest load
    const c = conn.current; if (!c) { setSayStatus('The helper is offline'); return; } const pick = await c.pickFolder(); if (!pick.ok) { if (pick.error !== 'cancelled') setSayStatus(`Crew not loaded: ${pick.error}`); return; }
    const r = await c.readCrew(pick.path); if (!r.ok) { setSayStatus(`Crew not loaded: ${r.error}`); return; } setCrewFilesState(r.files); const err = saveCrewFiles(project.id, r.files); const res = loadCrew(DEFAULT_CREW, r.files);
    setSayStatus(`Crew: ${res.crew.length} designers${r.files.length ? ` (${r.files.length} sheet${r.files.length === 1 ? '' : 's'} found${res.overridden.length ? `, overriding ${res.overridden.join(', ')}` : ''}${res.errors.length ? `, ${res.errors.length} refused` : ''})` : ' (no project sheets in that folder: the bundled five)'}${err ? ` · not remembered: ${err}` : ''}`);
  };
  const dtcgFile = useRef<HTMLInputElement>(null);
  const exportDtcg = () => { const { skipped } = toDtcg(brand); const url = URL.createObjectURL(new Blob([dtcgString(brand)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'tokens.json'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); setSayStatus(`Exported tokens.json (${Object.keys(brand).length - skipped.length} tokens${skipped.length ? `, ${skipped.length} not exportable: ${skipped.map((x) => x.name).join(', ')}` : ''})`); };
  const importDtcg = async (file: File) => { // merged into the kit (same names are replaced); designs are not recoloured, use the Brand editor for that
    const r = fromDtcg(await file.text()); if (!r.ok) { setSayStatus(`Cannot import ${file.name}: ${r.error}`); return; } const merged = { ...brand, ...r.tokens }; if (Object.keys(merged).length > 64) { setSayStatus('Cannot import: the kit would pass 64 tokens'); return; }
    const err = saveBrand(merged, undefined, project.id); if (err) { setSayStatus(`Brand not saved: ${err}`); return; } setBrand(merged); setRevision((n) => n + 1); setSayStatus(`Imported ${Object.keys(r.tokens).length} tokens from ${file.name}${r.skipped.length ? ` · ${r.skipped.length} skipped (${r.skipped.slice(0, 3).map((x) => `${x.name}: ${x.reason}`).join('; ')}${r.skipped.length > 3 ? '…' : ''})` : ''}`);
  };
  const [typeBusy, setTypeBusy] = useState('');
  const describeType = async (id: string) => { // type cues: Claude reads the reference's typography into its note (replaces an older note); the note goes into Spark prompts as text
    const c = conn.current; const r = mood.find((x) => x.id === id); const m = r?.dataUrl ? /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(r.dataUrl) : null; if (!c || !r || !m) { setSayStatus('Moodboard: cannot read this reference'); return; }
    if (helper.claudeStatus && helper.claudeStatus.state !== 'ready') { setSayStatus(`Claude is not ready: ${helper.claudeStatus.message}`); return; } setTypeBusy(id); let text = '', err = '';
    await new Promise<void>((done) => c.say(TYPE_SYSTEM, TYPE_PROMPT, (e) => { if (e.kind === 'delta') text += e.text; else { if (e.kind === 'error') err = e.text; done(); } }, [{ mediaType: m[1] as 'image/jpeg' | 'image/png', data: m[2]! }]));
    setTypeBusy(''); const cue = err && !text ? null : parseTypeCue(text); if (!cue) { setSayStatus(err ? `Type cue failed: ${err}` : 'Claude gave no usable type description'); return; } changeMood(setNote(mood, id, cue)); setSayStatus(`${r.name}: ${cue}`);
  };
  const addMoodImage = useCallback(async (f: File) => {
    try { const bmp = await createImageBitmap(f); const draw = (w: number) => { const h = Math.max(1, Math.round((bmp.height / bmp.width) * w)); const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!; g.drawImage(bmp, 0, 0, w, h); return { c, g, w, h }; };
      const small = draw(48); const colors = dominantColors(small.g.getImageData(0, 0, small.w, small.h).data, 5); const thumb = draw(480).c.toDataURL('image/jpeg', 0.7); /* big enough for Claude to read type from */ const r = addRef(mood, { name: f.name.replace(/\.[^.]+$/, ''), dataUrl: thumb, colors });
      if (!r.ok) setSayStatus(`Moodboard: ${r.error}`); else changeMood(r.board); } catch { setSayStatus('Moodboard: that file is not an image I can read'); }
  }, [mood, changeMood]);
  // Skill refiner (#1694): asks the local Claude about FLAGGED skills only; proposals are shown, never applied. Last run time is kept per device.
  const [proposals, setProposals] = useState<Proposal[]>([]); const [refining, setRefining] = useState(false); const [refineNote, setRefineNote] = useState('');
  const lastRefine = (): number | null => { try { const v = Number(localStorage.getItem('swift-canvas.refine.last')); return v > 0 ? v : null; } catch { return null; } };
  const refine = useCallback(async () => {
    const c = conn.current; if (!c || refining) return; const stats = summarize(recsRef.current); const prompt = refinePrompt(stats, { say: buildSystemPrompt({ tokens: brand, ids: ['<element ids of the frame>'], tree: '<the frame markup is inserted here>' }), spark: DIRECTIONS.map((d) => `${d.name}: ${d.prompt}`).join('\n') }); // the prompts these skills really use, with the frame parts elided
    if (!prompt) { setRefineNote('Nothing is flagged: no skill is slow or often undone yet.'); return; }
    setRefining(true); setRefineNote('Asking Claude…'); let text = ''; let err = '';
    await new Promise<void>((done) => c.say('You are a careful reviewer. Answer only in the requested format.', prompt, (e) => { if (e.kind === 'delta') text += e.text; else { if (e.kind === 'error') err = e.text; done(); } }));
    setRefining(false); if (err && !text) { setRefineNote(`Review failed: ${err}`); return; }
    const r = parseProposals(text, stats.map((x) => x.skill)); setProposals(r.proposals); try { localStorage.setItem('swift-canvas.refine.last', String(Date.now())); } catch { /* not stored */ }
    setRefineNote(`${r.proposals.length} proposal${r.proposals.length === 1 ? '' : 's'}${r.rejected.length ? ` · ${r.rejected.length} rejected` : ''} (shown only, nothing applied)`);
  }, [refining]);
  const [dropping, setDropping] = useState(false); // while an image is dragged over the window, a cover catches the drop (frames are sandboxed iframes that would swallow it)
  useEffect(() => { // pasting or dropping an image (outside a text field for paste) adds it to the moodboard
    const onPaste = (e: ClipboardEvent) => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/')); if (!f) return; e.preventDefault(); void addMoodImage(f); };
    const hasImage = (e: DragEvent) => [...(e.dataTransfer?.items ?? [])].some((i) => i.kind === 'file' && i.type.startsWith('image/'));
    const onOver = (e: DragEvent) => { if (hasImage(e)) e.preventDefault(); }; // allow the drop
    const onDrop = (e: DragEvent) => { const f = [...(e.dataTransfer?.files ?? [])].find((x) => x.type.startsWith('image/')); if (!f) return; e.preventDefault(); void addMoodImage(f); };
    const onEnter = (e: DragEvent) => { if (hasImage(e)) setDropping(true); }; const onEnd = () => setDropping(false);
    window.addEventListener('paste', onPaste); window.addEventListener('dragover', onOver); window.addEventListener('drop', onDrop); window.addEventListener('dragenter', onEnter); window.addEventListener('dragend', onEnd); window.addEventListener('drop', onEnd);
    return () => { window.removeEventListener('paste', onPaste); window.removeEventListener('dragover', onOver); window.removeEventListener('drop', onDrop); window.removeEventListener('dragenter', onEnter); window.removeEventListener('dragend', onEnd); window.removeEventListener('drop', onEnd); };
  }, [addMoodImage]);
  // Opt-in weekly review (OFF by default: it spends a little subscription): once per due period, when the helper is connected and some skill is flagged.
  const [autoRefine, setAutoRefine] = useState<boolean>(() => { try { return localStorage.getItem('swift-canvas.refine.auto') === '1'; } catch { return false; } });
  const toggleAutoRefine = (on: boolean) => { setAutoRefine(on); try { localStorage.setItem('swift-canvas.refine.auto', on ? '1' : '0'); } catch { /* not stored */ } };
  const autoRan = useRef(false);
  useEffect(() => { if (!autoRefine || autoRan.current || helper.status !== 'connected' || !isDue(lastRefine(), Date.now()) || summarize(recsRef.current).every((x) => flags(x).length === 0)) return; autoRan.current = true; void refine(); }, [autoRefine, helper.status, refine]);
  // Token usage per Claude request (from the helper's result.usage; Say and each Spark take), local only, for the usage meter.
  const [usage, setUsage] = useState(() => loadUsage()); const usageRef = useRef(usage);
  const addTokens = useCallback((u: Usage | undefined) => { if (!u) return; usageRef.current = appendUsage(usageRef.current, { ...u, at: Date.now() }); setUsage(usageRef.current); saveUsage(usageRef.current); }, []);
  const [library, setLibrary] = useState<LibItem[]>(() => loadLibrary()); const [libFilter, setLibFilter] = useState<string | null>(null);
  const dropFromLibrary = useCallback((id: string) => { const next = removeItem(library, id); setLibrary(next); const err = saveLibrary(next); setSayStatus(err ? `Removed for now, not stored: ${err}` : 'Removed from the library'); }, [library]);
  const [brand, setBrand] = useState<Record<string, string>>(() => loadBrand(undefined, project.id));
  const [links, setLinksState] = useState<Link[]>(() => loadLinks(project.id)); const [playFlow, setPlayFlow] = useState(false); const [linkTo, setLinkTo] = useState(''); const flowBack = useRef<string[]>([]);
  const setLinks = useCallback((l: Link[]) => { setLinksState(l); const err = saveLinks(project.id, l); if (err) setSayStatus(`Links not saved: ${err}`); }, [project.id]);
  const [motion, setMotionState] = useState<Timeline>(() => loadTimeline(project.id)); const [mt, setMt] = useState(0); const [mProp, setMProp] = useState('opacity'); const [mEase, setMEase] = useState<Ease>('expo.out'); const [playing, setPlaying] = useState(false);
  useEffect(() => { const ids = frames.map((f) => f.id); if (ready && links.some((l) => !ids.includes(l.frame) || !ids.includes(l.to))) setLinks(pruneLinks(links, ids)); }, [frames, links, ready, setLinks]); // a deleted frame takes its links with it
  useEffect(() => { if (!playFlow) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPlayFlow(false); setSayStatus('Stopped playing'); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [playFlow]);
  const setMotion = useCallback((tl: Timeline) => { setMotionState(tl); const err = saveTimeline(project.id, tl); if (err) setSayStatus(`Motion not saved: ${err}`); }, [project.id]);
  const sparkN = useRef(nextSparkN(frames)); const [sparkStatus, setSparkStatus] = useState(''); const sparkAbort = useRef<AbortController | null>(null); const takesRunning = useRef(new Map<string, AbortController>()); const [painting, setPainting] = useState<Set<string>>(new Set()); const [sparking, setSparking] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>(() => loadTheme()); const [appearanceOpen, setAppearanceOpen] = useState(false); const [importOpen, setImportOpen] = useState(false); const pjRef = useRef<HTMLButtonElement>(null); const swatchRef = useRef<HTMLButtonElement>(null); const [shortcutsOpen, setShortcutsOpen] = useState(false); const [frameMenuOpen, setFrameMenuOpen] = useState(false); const fmRef = useRef<HTMLButtonElement>(null); const fileRef = useRef<HTMLInputElement>(null); const kbRef = useRef<HTMLButtonElement>(null);
  const { mode, vars } = useMemo(() => computeTheme(theme), [theme]);
  useEffect(() => saveTheme(theme), [theme]);
  useEffect(() => { (window as Window & { __theme?: unknown }).__theme = { set: (p: Partial<ThemeChoice>) => setTheme((t) => sanitize({ ...t, ...p })), get: () => theme }; }, [theme]);
  // Escape closes an open popover with focus ANYWHERE (a focused button that becomes disabled drops focus to <body>, outside any element handler); focus returns to its trigger.
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (frameMenuOpen) { setFrameMenuOpen(false); fmRef.current?.focus(); } else if (shortcutsOpen) { setShortcutsOpen(false); kbRef.current?.focus(); } else if (importOpen) { setImportOpen(false); pjRef.current?.focus(); } else if (appearanceOpen) { setAppearanceOpen(false); swatchRef.current?.focus(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [importOpen, appearanceOpen, shortcutsOpen, frameMenuOpen]);
  const sayRef = useRef<HTMLInputElement>(null); const sayHist = useRef<string[]>([]); const histPos = useRef(0); const draft = useRef('');
  // ⌘K / Ctrl+K: jump to the Say input from anywhere (also closes an open popover so the keys are not swallowed).
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setImportOpen(false); setAppearanceOpen(false); setShortcutsOpen(false); setFrameMenuOpen(false); sayRef.current?.focus(); sayRef.current?.select(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  const closeAppearance = useCallback(() => { setAppearanceOpen(false); swatchRef.current?.focus(); }, []);
  const [tier0, setTier0] = useState<string>('');
  const editTokenRef = useRef<((name: string, value: string) => Promise<void>) | null>(null); const editTokensRef = useRef<((pairs: { name: string; value: string }[]) => Promise<void>) | null>(null);
  const [selection, setSelection] = useState<Sel | null>(null); const [xs, setXs] = useState<{ key: string; els: string[] }>({ key: '', els: [] }); const selKey = selection ? `${selection.frameId}/${selection.el}` : ''; const extras = xs.key === selKey ? xs.els : []; /* shift-click extras, valid only for the primary they were built on */ const [revision, setRevision] = useState(0);
  // One op log for the whole session (app/src/oplog.ts, design docs/oplog-design.md): undo/redo move its head; a new op drops the redo tail.
  const logRef = useRef<Log>(loadLog(undefined, project.id) ?? L.emptyLog()); // the saved undo history comes back with the design (empty when none or damaged)
  const [edits, setEdits] = useState(() => logRef.current.head); const [redos, setRedos] = useState(() => { const l = logRef.current; return l.branches[l.current]!.ops.length - l.head; });
  const [, setLogRev] = useState(0); // re-render when the branch set/current changes even if the counts do not
  const syncLog = useCallback(() => { const l = logRef.current; setEdits(l.head); setRedos(l.branches[l.current]!.ops.length - l.head); setLogRev((n) => n + 1); }, []);
  const recordOp = useCallback((op: Op) => { logRef.current = L.push(logRef.current, op); syncLog(); }, [syncLog]);
  const lastEditAt = useRef(0);
  const edit = useCallback(async (frameId: string, el: string, prop: string, value: string, record = true, coalesce = false) => {
    const r = await window.__swift?.edit(frameId, el, prop, value); if (!r?.ok) return;
    if (record) { const now = Date.now(); const merged = coalesce && now - lastEditAt.current < 800 ? L.amendLast(logRef.current, (o) => (o.kind === 'set' && o.frame === frameId && o.el === el && o.prop === prop ? { ...o, after: value } : null)) : null; // rapid edits of one property = ONE undo step
      if (merged) { logRef.current = merged; syncLog(); } else recordOp({ kind: 'set', frame: frameId, el, prop, before: r.before, after: value }); lastEditAt.current = now; }
    setTier0(`Tier 0 · ${r.ms.toFixed(1)} ms`); setRevision((n) => n + 1);
  }, [recordOp, syncLog]);
  // Apply one op to the design (undo applies the inverted op, redo the op itself).
  const runOp = useCallback(async (op: Op): Promise<void> => {
    const sw = window.__swift; if (!sw) return;
    switch (op.kind) {
      case 'set': await edit(op.frame, op.el, op.prop, op.after, false); return;
      case 'snap': await sw.load(op.frame, op.after); setRevision((n) => n + 1); return;
      case 'add': if (!(await sw.add(op.frame, op.parent, op.html))) throw new Error(`could not add to ${op.frame}/${op.parent}`); setRevision((n) => n + 1); return;
      case 'remove': { const id = /^\s*<[a-zA-Z][^>]*?\sid="([^"]+)"/.exec(op.html)?.[1]; if (!id) throw new Error('cannot remove: the markup has no id'); await sw.remove(op.frame, id); setRevision((n) => n + 1); return; } // the element is named by its own id
      case 'frameDel': setFrames((f) => f.filter((x) => x.id !== op.def.id)); setSelection(null); return;
      case 'frameAdd': setFrames((f) => (f.some((x) => x.id === op.def.id) ? f : [...f.slice(0, op.index), op.def, ...f.slice(op.index)])); return;
      case 'discard': { const ids = new Set(op.items.map((i) => i.def.id)); setFrames((f) => f.filter((x) => !ids.has(x.id))); setSelection(null); return; }
      case 'restore': setFrames((f) => { const out = [...f]; for (const it of [...op.items].sort((p, q) => p.index - q.index)) if (!out.some((x) => x.id === it.def.id)) out.splice(Math.min(it.index, out.length), 0, it.def); return out; }); return;
      case 'brand': setBrand((b) => { const next = { ...b, [op.name]: op.after }; saveBrand(next, undefined, project.id); return next; }); setRevision((n) => n + 1); return; // revision bump: the autosave must see this step too
      case 'rename': setFrames((f) => f.map((x) => (x.id === op.frame ? { ...x, title: op.after } : x))); return;
      case 'group': for (const o of op.ops) await runOp(o); return;
      default: throw new Error(`the app does not apply "${op.kind}" ops yet`);
    }
  }, [edit]);
  const undo = useCallback(async () => {
    const cur = L.lastApplied(logRef.current); if (!cur || !window.__swift) return; const u = L.undo(logRef.current); logRef.current = u.log; syncLog(); markRec(cur.rec, true); await runOp(u.apply!);
    if (cur.kind === 'snap') setSayStatus('Say undone'); else if (cur.kind === 'frameDel') setSayStatus('Frame restored'); else if (cur.kind === 'rename') setSayStatus('Rename undone'); else if (cur.kind === 'discard') setSayStatus(`${cur.items.length} takes restored`);
  }, [runOp, syncLog, markRec]);
  const redo = useCallback(async () => {
    const nxt = L.nextRedo(logRef.current); if (!nxt || !window.__swift) return; const r = L.redo(logRef.current); logRef.current = r.log; syncLog(); markRec(nxt.rec, false); await runOp(r.apply!);
    if (nxt.kind === 'snap') setSayStatus('Redone'); else if (nxt.kind === 'frameDel') setSayStatus('Frame deleted'); else if (nxt.kind === 'rename') setSayStatus('Rename redone'); else if (nxt.kind === 'discard') setSayStatus(`${nxt.items.length} takes discarded`);
  }, [runOp, syncLog, markRec]);
  // Branches (#1741): fork the current point, switch (replays exactly the difference), keep (fast-forward main), delete.
  const busy = saying || sparking;
  const forkHere = useCallback(() => { if (busy) return; let n = 1; while (logRef.current.branches[`try-${n}`]) n++; const r = L.fork(logRef.current, `try-${n}`); if (!r.ok) { setSayStatus(r.error); return; } logRef.current = r.log; syncLog(); setSayStatus(`Forked try-${n}: edits now go to it, main stays as it was`); }, [busy, syncLog]);
  const branchFromTake = useCallback(async () => { // B: a new branch where the ORIGINAL frame shows this take's design; main keeps its own
    const api = window.__swift; const sel = selectionRef.current; if (busy || !api || !sel) return; const orig = originalId(sel.frameId); if (!orig || !frames.some((f) => f.id === orig)) { setSayStatus('Select a take or copy to branch from it'); return; }
    let n = 1; while (logRef.current.branches[`take-${n}`]) n++; const f = L.fork(logRef.current, `take-${n}`); if (!f.ok) { setSayStatus(f.error); return; }
    const [takeHtml, before] = await Promise.all([api.snapshot(sel.frameId), api.snapshot(orig)]); if (!takeHtml || !before) { setSayStatus('Could not read the take'); return; } if (!(await api.load(orig, takeHtml))) { setSayStatus('Could not branch: the original frame did not answer'); return; }
    logRef.current = f.log; recordOp({ kind: 'snap', frame: orig, before, after: await api.snapshot(orig) }); setSelection(null); setRevision((x) => x + 1); setSayStatus(`Branch take-${n}: ${orig} now shows ${sel.frameId}; switch to main to see it as it was`);
  }, [busy, frames, recordOp]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key.toLowerCase() !== 'b' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return; const t = e.target; if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return; e.preventDefault(); void branchFromTake(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [branchFromTake]);
  const switchBranch = useCallback(async (name: string) => {
    if (busy) return; const r = L.switchTo(logRef.current, name); if ('error' in r) { setSayStatus(r.error); return; }
    try { for (const op of r.steps) await runOp(op); } catch (e) { setSayStatus(`Could not switch to ${name}: ${e instanceof Error ? e.message : 'failed'}`); return; }
    logRef.current = r.log; syncLog(); setSelection(null); setSayStatus(`On ${name}`);
  }, [busy, runOp, syncLog]);
  const keepBranch = useCallback(() => { const r = L.keep(logRef.current, logRef.current.current); if (!r.ok) { setSayStatus(r.error); return; } logRef.current = r.log; syncLog(); setSayStatus('Kept: main now includes this branch'); }, [syncLog]);
  const [mergeAsk, setMergeAsk] = useState<{ name: string; conflicts: Conflict[]; picks: Record<string, Choice> } | null>(null);
  const doMerge = useCallback(async (name: string, picks: Record<string, Choice> = {}) => { // conflicts open the sheet; otherwise the merged ops run as ONE undo step
    if (busy) return; const r = mergeBranch(logRef.current, name, picks); if (!r.ok) { if ('conflicts' in r) { setMergeAsk({ name, conflicts: r.conflicts, picks }); return; } setSayStatus(r.error); return; }
    setMergeAsk(null); if (r.apply) { try { await runOp(r.apply); } catch (e) { setSayStatus(`Merge failed, nothing changed: ${e instanceof Error ? e.message : 'failed'}`); return; } }
    logRef.current = r.log; syncLog(); setRevision((n) => n + 1); setSayStatus(`Merged ${name} into ${r.log.current}${r.apply ? ' (one undo step)' : ' (nothing new to add)'}`);
  }, [busy, runOp, syncLog]);
  const dropBranch = useCallback((name: string) => { const r = L.remove(logRef.current, name); if (!r.ok) { setSayStatus(r.error); return; } logRef.current = r.log; syncLog(); setSayStatus(`Deleted ${name}`); }, [syncLog]);
  const spark = useCallback(async (n = 4) => {
    const c = conn.current; const base = frames.find((f) => f.id === (selection?.frameId ?? frames[0]?.id ?? '')); if (!window.__swift || !c || !base || sparking) return;
    if (helper.claudeStatus && helper.claudeStatus.state !== 'ready') { setSparkStatus(`Claude is not ready: ${helper.claudeStatus.message}`); return; }
    const gate = canSpark(frames, n); if (!gate.ok) { setSparkStatus(gate.reason); return; }
    setSparking(true); setSparkStatus(`Sparking ${n} directions…`); const ac = new AbortController(); sparkAbort.current = ac;
    const r = await runSpark({ api: liveApi, send: c.say, base, n, nextId: () => `${base.id}-t${++sparkN.current}`, addFrames: (f) => { setFrames((e) => [...e, ...f]); setPainting(new Set(f.map((x) => x.id))); }, signal: ac.signal, tokens: brand, extra: moodboardPrompt(mood), running: takesRunning.current, onTakeDone: (id) => setPainting((p) => { const n = new Set(p); n.delete(id); return n; }) }); setPainting(new Set()); sparkAbort.current = null;
    const ok = r.takes.filter((t) => t.result.applied.length > 0).length; const err = r.takes.find((t) => t.result.error)?.result.error; const rej = r.takes.reduce((n, t) => n + t.result.rejected.length, 0); let spent: Usage = { input: 0, output: 0 }; for (const t of r.takes) { addTokens(t.result.usage); if (t.result.usage) spent = addUsage(spent, t.result.usage); } const spentTxt = spent.input + spent.output > 0 ? ` · ${tokensShort(spent.input + spent.output)} tokens (est. ${tokensShort((e => e.input + e.output)(estimateSpark(usageRef.current.slice(0, -r.takes.length), n)))})` : ''; track({ at: Date.now(), tier: 'claude', skill: 'spark', model: 'claude-code', ms: r.totalMs, ok: ok > 0 }); setSparkStatus(`${r.takes.length} takes · ${ok} changed${r.firstPaintMs !== null ? ` · first paint ${r.firstPaintMs.toFixed(0)} ms` : ''} · ${(r.totalMs / 1000).toFixed(1)} s${rej ? ` · ${rej} rejected` : ''}${err ? ` · ${err}` : ''}${spentTxt}`); setSparking(false);
  }, [frames, selection, sparking, brand, track, mood, helper.claudeStatus, addTokens]);
  const say = useCallback(async (override?: string) => {
    const text = (override ?? sayText).trim(); const c = conn.current; if (!text || !window.__swift || !c || saying) return;
    sayHist.current = pushHistory(sayHist.current, text); histPos.current = sayHist.current.length;
    const ez = !pendingAsk ? easeRequest(text) : null; if (ez) { setSayText(''); if (!selection) { setSayStatus('Select an animated element first'); return; } if (!motion.tracks.some((x) => x.frame === selection.frameId && x.el === selection.el)) { setSayStatus(`${selection.el} has no keyframes yet: scrub and use Key here`); return; } setMotion(motionEase(motion, selection.frameId, selection.el, ez)); track({ at: Date.now(), tier: 'local', skill: 'motion', model: 'rules', ms: 0, ok: true, prompt: text.slice(0, 200) }); setSayStatus(`Local · ${selection.el}: ${ez}`); return; } // "make it ease out": the selected element's keyframes, no model
    const th = !pendingAsk ? themeRequest(text, brand) : null; if (th && editTokensRef.current) { const t0 = performance.now(); await editTokensRef.current(th); track({ at: Date.now(), tier: 'local', skill: 'token', model: 'rules', ms: performance.now() - t0, ok: true, prompt: text.slice(0, 200) }); setSayText(''); return; } // dark / light theme: the background and text tokens together, one undo step
    const tk = !pendingAsk ? tokenRequest(text, brand) : null; if (tk && editTokenRef.current) { const t0 = performance.now(); await editTokenRef.current(tk.name, tk.value); track({ at: Date.now(), tier: 'local', skill: 'token', model: 'rules', ms: performance.now() - t0, ok: true, prompt: text.slice(0, 200) }); setSayText(''); return; } // a colour token request: the Brand editor path, no model
    const frame0 = frames.find((f) => f.id === (selection?.frameId ?? frames[0]?.id ?? '')); const localTarget: Sel | null = selection ?? (frame0 ? { frameId: frame0.id, el: frame0.root } : null); // nothing selected: the local tier works on the FRAME (its root element)
    if (frame0 && !pendingAsk && window.__swift) { // px / font tokens ("make the glass thicker", "use Barlow instead of Inter"): a custom property on the frame root, one undo step, no model
      const first = propTokenRequest(text, brand); if (first) { const t0 = performance.now(); const live = (await window.__swift.get(frame0.id, frame0.root, first.name))?.trim(); const pt = (live && propTokenRequest(text, { ...brand, [first.name]: live })) || first; await edit(frame0.id, frame0.root, pt.name, pt.value);
        track({ at: Date.now(), tier: 'local', skill: 'token', model: 'rules', ms: performance.now() - t0, ok: true, prompt: text.slice(0, 200) }); setSayText(''); setSayStatus(`Local · ${pt.name}: ${pt.value} · ${(performance.now() - t0).toFixed(0)} ms`); return; } }
    if (localTarget && !pendingAsk && window.__swift) { // local tier: unambiguous requests on the selection (or the frame) never reach Claude
      const t0 = performance.now(); const sel = localTarget; const edits = await localEdits(text, { get: (p) => window.__swift!.get(sel.frameId, sel.el, p) });
      if (extras.length) { // several elements: compute every edit first (all or none), apply them live, ONE undo step via a snapshot
        const per: { el: string; edits: NonNullable<typeof edits> }[] = []; for (const el of [sel.el, ...extras]) { const ed = await localEdits(text, { get: (p) => window.__swift!.get(sel.frameId, el, p) }); if (!ed) { per.length = 0; break; } per.push({ el, edits: ed }); }
        if (per.length) { const api = window.__swift; const before = await api.snapshot(sel.frameId); for (const x of per) for (const e of x.edits) await api.edit(sel.frameId, x.el, e.prop, e.value);
          recordOp({ kind: 'snap', frame: sel.frameId, before, after: await api.snapshot(sel.frameId) }); track({ at: Date.now(), tier: 'local', skill: 'local', model: 'rules', ms: performance.now() - t0, ok: true, prompt: text.slice(0, 200) }); setRevision((n) => n + 1); setSayText(''); setSayStatus(`Local · ${per.length} elements · ${per[0]!.edits.map((e) => e.prop).join(', ')} · ${(performance.now() - t0).toFixed(0)} ms`); return; }
      }
      if (edits && edits.length > 1) { const api = window.__swift; const before = await api.snapshot(sel.frameId); for (const e of edits) await api.edit(sel.frameId, sel.el, e.prop, e.value); recordOp({ kind: 'snap', frame: sel.frameId, before, after: await api.snapshot(sel.frameId) }); track({ at: Date.now(), tier: 'local', skill: 'local', model: 'rules', ms: performance.now() - t0, ok: true, prompt: text.slice(0, 200) }); setRevision((n) => n + 1); setSayText(''); setSayStatus(`Local · ${edits.map((e) => `${e.prop}: ${e.value}`).join(', ')} · ${(performance.now() - t0).toFixed(0)} ms`); return; } // several properties = ONE undo step
      if (edits) { for (const e of edits) await edit(sel.frameId, sel.el, e.prop, e.value); const rec = track({ at: Date.now(), tier: 'local', skill: 'local', model: 'rules', ms: performance.now() - t0, ok: true, prompt: text.slice(0, 200) }); const tagged = L.amendLast(logRef.current, (o) => (o.kind === 'set' ? { ...o, rec } : null)); if (tagged) logRef.current = tagged; setSayText(''); setSayStatus(`Local · ${edits.map((e) => `${e.prop}: ${e.value}`).join(', ')} · ${(performance.now() - t0).toFixed(0)} ms`); return; }
    }
    if (helper.claudeStatus && helper.claudeStatus.state !== 'ready') { setSayStatus(`Claude is not ready: ${helper.claudeStatus.message} (local edits still work)`); return; }
    const frameId = selection?.frameId ?? frames[0]?.id ?? ''; const root = frames.find((f) => f.id === frameId)?.root ?? frameId; setSaying(true); setSayStatus('Saying…');
    const base = pendingAsk ? `${pendingAsk.original}\n\nYou asked: "${pendingAsk.question}". My answer: ${text}` : text; setPendingAsk(null);
    const r = await runSayRepairing({ api: liveApi, send: c.say, frameId, root, request: selection ? `${base} (${extras.length ? `the selected elements are ${[selection.el, ...extras].map((e) => '#' + e).join(', ')}: apply the change to each` : `the selected element is #${selection.el}`})` : base, tokens: brand, selected: selection?.el });
    if (r.asked[0] && r.applied.length === 0) setPendingAsk({ question: r.asked[0], original: pendingAsk ? pendingAsk.original : text }); setSayText('');
    addTokens(r.usage); const rec = track({ at: Date.now(), tier: 'claude', skill: 'say', model: 'claude-code', ms: r.totalMs, ok: r.applied.length > 0 || r.asked.length > 0, prompt: text.slice(0, 200), rejected: r.rejected.length, ...(r.firstMs !== null ? { firstMs: r.firstMs } : {}) });
    if (r.applied.length > 0) recordOp({ kind: 'snap', frame: frameId, before: r.snapshot, after: await window.__swift.snapshot(frameId), rec });
    setSayStatus(r.error && r.applied.length === 0 ? `Say failed: ${r.error}` : `${r.applied.length} applied${r.repaired ? ` · ${r.repaired} repaired` : ''}${r.rejected.length ? ` · ${r.rejected.length} rejected` : ''}${r.firstMs !== null ? ` · first change ${r.firstMs.toFixed(0)} ms` : ''} · ${(r.totalMs / 1000).toFixed(1)} s${r.asked[0] ? ` · Claude asks: ${r.asked[0]}` : ''}${r.error && r.applied.length > 0 ? ` · stopped early: ${r.error}` : ''}`); // a Say cut off after some ops still says so
    setRevision((n) => n + 1); setSaying(false);
  }, [sayText, saying, selection, extras, frames, brand, pendingAsk, edit, brand, track, helper.claudeStatus, recordOp, addTokens, motion, setMotion]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || e.target instanceof HTMLInputElement) return; e.preventDefault(); void (e.shiftKey ? redo() : undo()); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [undo, redo]);
  // Autosave: after the document changes settle, snapshot every frame (current HTML) and store the design; a failure is shown, not swallowed.
  const persist = useCallback(async (): Promise<string | null> => {
    if (!window.__swift || !ready) return null; // not before the helper copy had its chance to restore (else fresh fixtures would overwrite it)
    try {
      const snaps = await Promise.all(frames.map(async (f) => ({ ...f, html: (await window.__swift!.snapshot(f.id)) || f.html }))); const err = saveDoc(snaps, undefined, project.id, logRef.current);
      const backup = err ? null : await conn.current?.storePut(project.id, JSON.stringify({ frames: snaps, log: fitLog(logRef.current) }));
      setSaveStatus(err ? `not saved: ${err}` : backup && !backup.ok && backup.error !== 'helper offline' ? `saved · backup failed: ${backup.error}` : 'saved'); return err; } catch (e) { const m = e instanceof Error ? e.message : 'error'; setSaveStatus(`not saved: ${m}`); return m; }
  }, [frames, project.id, ready]);
  useEffect(() => { const t = setTimeout(() => void persist(), 1000); return () => clearTimeout(t); }, [persist, revision]);
  useEffect(() => { const h = () => { if (document.visibilityState === 'hidden') void persist(); }; document.addEventListener('visibilitychange', h); return () => document.removeEventListener('visibilitychange', h); }, [persist]); // leaving the tab flushes at once, not after the 1 s debounce
  // First connect without a local copy (cleared browser data, new profile): restore the design from the helper's project file.
  useEffect(() => {
    if (ready || helper.status === 'connecting') return; if (helper.status === 'offline') { setReady(true); return; }
    let alive = true;
    void conn.current?.storeGet(project.id).then((r) => {
      if (!alive) return;
      if (!r.ok) setSayStatus(`Backup unreadable: ${r.error}`);
      else if (r.data) { let f: FrameDef[] | null = null; try { f = parseDoc(JSON.parse(r.data)); } catch { f = null; } if (f) { let lg: Log | null = null; try { lg = parseLog((JSON.parse(r.data) as { log?: unknown }).log); } catch { lg = null; } if (lg) { logRef.current = lg; syncLog(); } setFrames(f); sparkN.current = nextSparkN(f); setEpoch((n) => n + 1); setSayStatus(lg ? 'Restored from the helper (with its undo history)' : 'Restored from the helper'); } else setSayStatus('Backup is corrupt: starting fresh'); }
      setReady(true);
    });
    return () => { alive = false; };
  }, [helper.status, ready, project.id]);
  // Switching: flush the current design first (a failed save stops the switch), then store the registry and reload into the other project.
  const goTo = useCallback(async (next: Registry | null) => { if (!next) { setSayStatus('Could not create a project from that name'); return; } const err = await persist(); if (err) { setSayStatus(`Not switching: ${err}`); return; } const e2 = saveRegistry(next); if (e2) { setSayStatus(`Not switching: ${e2}`); return; } location.reload(); }, [persist]);
  const takeCount = useMemo(() => frames.filter(isTake).length, [frames]); const selIsTake = !!selection && frames.some((f) => f.id === selection.frameId && isTake(f));
  const cmp = useMemo(() => (selection ? compareSet(frames, selection.frameId) : null), [frames, selection]);
  const discard = useCallback(async () => {
    const takes = frames.map((f, index) => ({ f, index })).filter((x) => isTake(x.f)); if (takes.length === 0 || !window.__swift) return; const gone = new Set(takes.map((x) => x.f.id));
    const items = await Promise.all(takes.map(async ({ f, index }) => ({ def: { ...f, html: (await window.__swift!.snapshot(f.id)) || f.html }, index }))); // with their current markup, so undo brings them back as they were
    logRef.current = L.prune(logRef.current, (o) => 'frame' in o && gone.has(o.frame)); // edits inside the discarded takes can no longer be undone
    recordOp({ kind: 'discard', frame: takes[0]!.f.id, items }); if (selection && gone.has(selection.frameId)) setSelection(null); setFrames(discardTakes); setSparkStatus(`${gone.size} takes discarded (undo brings them back)`);
  }, [frames, selection]);
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
      else if (e.code === 'Digit2' && e.shiftKey && !e.metaKey && !e.ctrlKey && selection) { e.preventDefault(); api.fitTo([selection.frameId]); }
      else if (e.key === '?' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setImportOpen(false); setAppearanceOpen(false); setShortcutsOpen(true); }
      else if (e.key === 'Escape' && !importOpen && !appearanceOpen && !shortcutsOpen && !frameMenuOpen && selection) setSelection(null);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [selection, importOpen, appearanceOpen, shortcutsOpen, frameMenuOpen]);
  const [fxFound, setFxFound] = useState<{ id: string; effect: Effect }[]>([]); const [fxFrame, setFxFrame] = useState(''); const [fxDevice, setFxDevice] = useState<Device>('tv'); const fxStack = fxFound.map((x) => x.effect); const fxM = fxMeter(fxStack, fxDevice); const fxS = fxSuggest(fxStack, fxDevice);
  const fxTarget = () => frames.find((f) => f.id === (selection?.frameId ?? '')) ?? frames[0];
  const refreshFx = useCallback(async () => { const f = fxTarget(); const api = window.__swift; if (!f || !api) return; const html = await api.snapshot(f.id); setFxFrame(f.id); setFxDevice(surfaceOf(f)); setFxFound(html ? parseFx(html) : []); }, [frames, selection]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (frameMenuOpen) void refreshFx(); }, [frameMenuOpen, selection?.frameId, revision, refreshFx]);
  const addFx = async (preset: keyof typeof FX_PRESETS) => { // real layers in the frame (one undo step): the meter then reads them back from the markup
    const f = fxTarget(); const api = window.__swift; if (!f || !api) return; let html = await api.snapshot(f.id); if (!html) { setSayStatus('Frame not ready'); return; } const ops: Op[] = [];
    for (const e of FX_PRESETS[preset]) { const layer = fxHtml(fxId(html, e.kind), e); if (!(await api.add(f.id, f.root, layer))) { setSayStatus('Could not add the effect'); return; } html += layer; ops.push({ kind: 'add', frame: f.id, parent: f.root, html: layer }); }
    recordOp(ops.length === 1 ? ops[0]! : { kind: 'group', label: `add ${preset}`, ops }); setRevision((n) => n + 1); setSayStatus(`Added ${preset} to ${f.title}`);
  };
  const clearFx = async () => { const f = fxTarget(); const api = window.__swift; if (!f || !api || !fxFound.length) return; const before = await api.snapshot(f.id); for (const x of fxFound) await api.remove(f.id, x.id); recordOp({ kind: 'snap', frame: f.id, before, after: await api.snapshot(f.id) }); setRevision((n) => n + 1); setSayStatus(`Removed ${fxFound.length} effect layer${fxFound.length === 1 ? '' : 's'}`); };
  const applyFx = async () => { const f = fxTarget(); const api = window.__swift; if (!f || !api || !fxS) return; const before = await api.snapshot(f.id); for (let i = 0; i < fxFound.length; i++) { const e = fxS.stack[i]!; if (!(await api.replace(f.id, fxFound[i]!.id, fxHtml(fxFound[i]!.id, e)))) { setSayStatus('Could not apply'); return; } } recordOp({ kind: 'snap', frame: f.id, before, after: await api.snapshot(f.id) }); setRevision((n) => n + 1); setSayStatus(fxS.text); };
  const scrub = useCallback(async (t: number, tl: Timeline = motion) => { const api = window.__swift; if (!api) return; setMt(t); for (const x of motionSample(tl, t)) await api.edit(x.frame, x.el, x.prop, x.value); }, [motion]); // virtual time: sets the animated properties for time t, nothing plays; not an undo step
  useEffect(() => { if (!playing) return; let raf = 0; const t0 = performance.now() - mt; const tick = (now: number) => { const t = now - t0; if (t >= motion.duration) { void scrub(motion.duration); setPlaying(false); return; } void scrub(t); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [playing]);
  const addKey = async () => { const api = window.__swift; if (!api || !selection) { setSayStatus('Select an element first'); return; } const v = await api.get(selection.frameId, selection.el, mProp); if (v === undefined || v === '') { setSayStatus(`${mProp}: no value to key`); return; } const r = motionKey(motion, selection.frameId, selection.el, mProp, mt, v, mEase); if (!r.ok) { setSayStatus(r.error); return; } setMotion(r.tl); setSayStatus(`Key ${selection.el}.${mProp} = ${v} at ${Math.round(mt)} ms`); };
  const selectionRef = useRef(selection); selectionRef.current = selection; // the V key handler is bound once and must see the current selection
  const [chrome, setChromeState] = useState<boolean>(() => { try { return localStorage.getItem('swift-canvas.chrome') === '1'; } catch { return false; } }); const setChrome = (on: boolean) => { setChromeState(on); try { localStorage.setItem('swift-canvas.chrome', on ? '1' : '0'); } catch { /* a per-viewer convenience */ } };
  const [alts, setAlts] = useState<Alts>({}); const altsRef = useRef(alts); altsRef.current = alts; const selKeyAlt = selection ? altKey(selection.frameId, selection.el) : '';
  const saveAlt = async () => { const api = window.__swift; if (!api || !selection) return; const html = await api.outer(selection.frameId, selection.el); const r = saveVariant(altsRef.current, altKey(selection.frameId, selection.el), html); if (!r.ok) { setSayStatus(r.error); return; } setAlts(r.alts); setSayStatus(`Saved variant ${altCount(r.alts, altKey(selection.frameId, selection.el))} of ${selection.el}`); };
  const nextAlt = useCallback(async (dir: 1 | -1 = 1) => { // swap the element for the next saved look: ONE undo step
    const api = window.__swift; const sel = selectionRef.current; if (!api || !sel) return; const key = altKey(sel.frameId, sel.el); const c = altCycle(altsRef.current, key, dir); if (!c) { setSayStatus('Save at least two variants first (Frame menu → Alternates)'); return; }
    const before = await api.snapshot(sel.frameId); if (!(await api.replace(sel.frameId, sel.el, c.html))) { setSayStatus('Could not switch the variant'); return; } recordOp({ kind: 'snap', frame: sel.frameId, before, after: await api.snapshot(sel.frameId) }); setAlts(c.alts); setRevision((n) => n + 1); setSayStatus(`${sel.el}: variant ${c.index + 1} of ${c.of}`);
  }, [recordOp]);
  const keepAlt = () => { if (!selection) return; setAlts(keepOne(altsRef.current, altKey(selection.frameId, selection.el))); setSayStatus(`Kept this look of ${selection.el}`); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key.toLowerCase() !== 'v' || e.metaKey || e.ctrlKey || e.altKey) return; const t = e.target; if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return; e.preventDefault(); void nextAlt(e.shiftKey ? -1 : 1); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [nextAlt]);
  const [rendering, setRendering] = useState(false); const [renderPct, setRenderPct] = useState(''); const renderAbort = useRef<AbortController | null>(null);
  const renderMotion = async () => { // every 1/30 s: apply the timeline at t, snapshot the frame; the helper rasterizes and encodes (deterministic, nothing plays)
    const api = window.__swift; const c = conn.current; if (!api || !c) { setSayStatus('The helper is offline'); return; } const fid = selection?.frameId ?? motion.tracks[0]?.frame; const f = frames.find((x) => x.id === fid); if (!f || !motion.tracks.some((x) => x.frame === f.id)) { setSayStatus('Key something in a frame first'); return; }
    const fps = 30, n = Math.max(2, Math.round((motion.duration / 1000) * fps) + 1); if (n > 600) { setSayStatus('At most 600 frames (20 s at 30 fps)'); return; } setRendering(true); setRenderPct('Preparing…'); const ac = new AbortController(); renderAbort.current = ac; const t0 = performance.now();
    try { const docs: string[] = []; let bytes = 0; for (let i = 0; i < n; i++) { if (ac.signal.aborted) { await scrub(0); setSayStatus('Render cancelled'); return; } setRenderPct(`Preparing ${i + 1}/${n}`); const t = Math.min(motion.duration, (i * 1000) / fps); for (const x of motionSample(motion, t, f.id)) await api.edit(f.id, x.el, x.prop, x.value); const html = await api.snapshot(f.id); if (!html) throw new Error('frame not ready'); const d = exportDoc(f.title, html); bytes += d.length; if (bytes > 12 * 1024 * 1024) throw new Error('frames are too large to send (12 MB)'); docs.push(d); }
      await scrub(0); if (ac.signal.aborted) { setSayStatus('Render cancelled'); return; } setSayStatus(`Rendering ${n} frames…`); const r = await c.renderMp4(f.w, f.h, fps, docs, (d, t) => setRenderPct(`${d}/${t}`), ac.signal); if (!r.ok) { setSayStatus(r.error === 'cancelled' ? 'Render cancelled' : `Not rendered: ${r.error}`); return; }
      const url = URL.createObjectURL(new Blob([r.mp4.slice().buffer as ArrayBuffer], { type: 'video/mp4' })); const link = document.createElement('a'); link.href = url; link.download = exportName(f.title).replace(/\.html$/, '.mp4'); document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); setSayStatus(`Rendered ${link.download}: ${n} frames, ${(r.mp4.length / 1024).toFixed(0)} KB, ${((performance.now() - t0) / 1000).toFixed(1)} s`); }
    catch (e) { setSayStatus(`Not rendered: ${e instanceof Error ? e.message : 'failed'}`); } finally { setRendering(false); setRenderPct(''); renderAbort.current = null; }
  };
  const easeSel = () => { if (!selection) return; setMotion(motionEase(motion, selection.frameId, selection.el, mEase)); setSayStatus(`${selection.el}: ${mEase}`); };
  const [mixWith, setMixWith] = useState(''); const mixOptions = useMemo(() => (cmp ? frames.filter((f) => f.id !== cmp[1] && originalId(f.id) === cmp[0]) : []), [frames, cmp]);
  const mixTakes = async () => { // local, no model: the selected take + what the other take changed that it left alone, as a new copy frame (one undo step)
    const api = window.__swift; if (!api || !cmp || !mixWith) return; const [orig, a, b] = [cmp[0]!, cmp[1]!, mixWith]; const [so, sa, sb] = await Promise.all([api.sig(orig), api.sig(a), api.sig(b)]); if (!so || !sa || !sb) { setSayStatus('Could not read the frames'); return; }
    const m = mixEdits(so, sa, sb); const base = frames.find((f) => f.id === a); const html = await api.snapshot(a); if (!base || !html) { setSayStatus('Could not mix: frame not ready'); return; }
    for (const e of m.edits) { if ('text' in e) await api.text(a, e.el, e.text); else await api.edit(a, e.el, e.prop, e.value); } const mixed = await api.snapshot(a); await api.load(a, html); // the edits are applied to the take, read once, and the take is put back exactly as it was
    if (!mixed) { setSayStatus('Could not mix: frame not ready'); return; } const copy = { ...duplicateFrame(frames, base, duplicateId(frames, a), mixed), title: `${base.title} + ${frames.find((f) => f.id === b)?.title ?? b}` }; setFrames((f) => [...f, copy]); recordOp({ kind: 'frameAdd', frame: copy.id, def: copy, index: frames.length }); setRevision((n) => n + 1); setTimeout(() => api.fitTo([copy.id]), 150);
    setSayStatus(`Mixed: ${m.edits.length} change${m.edits.length === 1 ? '' : 's'} from ${b} added to ${a}${m.conflicts ? ` · ${m.conflicts} clash${m.conflicts === 1 ? '' : 'es'} kept as ${a}` : ''}${m.skipped ? ` · ${m.skipped} added/removed element${m.skipped === 1 ? '' : 's'} not mixed` : ''}`);
  };
  const [changes, setChanges] = useState<{ pair: string; list: Change[] } | null>(null);
  const whatChanged = async () => { const api = window.__swift; if (!api || !cmp) return; const t0 = performance.now(); const [a, b] = await Promise.all([api.sig(cmp[0]!), api.sig(cmp[1]!)]); if (!a || !b) { setSayStatus('Could not read both frames'); return; } setChanges({ pair: `${cmp[1]} vs ${cmp[0]} · ${(performance.now() - t0).toFixed(0)} ms`, list: diffSigs(a, b) }); };
  const [findings, setFindings] = useState<(Finding & { frame: string })[]>([]); const [checkNote, setCheckNote] = useState(''); const checkedFrame = useRef('');
  const checkFrame = async () => { const f = frames.find((x) => x.id === selection?.frameId) ?? frames[0]; const api = window.__swift; if (!f || !api) return; const t0 = performance.now(); const facts = await api.audit(f.id); if (!facts) { setCheckNote('frame did not answer'); return; }
    const found = auditFacts(facts, surfaceOf(f)); checkedFrame.current = f.id; setFindings(found.map((x) => ({ ...x, frame: f.id }))); setCheckNote(`${f.title}: ${found.length} finding${found.length === 1 ? '' : 's'} · ${(performance.now() - t0).toFixed(0)} ms`); };
  const [critiquing, setCritiquing] = useState(false);
  const askClaude = async () => { // the local pre-pass first (instant, free), then Claude only for what needs judgment; its findings are validated before they are shown
    const f = frames.find((x) => x.id === selection?.frameId) ?? frames[0]; const api = window.__swift; const c = conn.current; if (!f || !api || !c || critiquing) return;
    if (helper.claudeStatus && helper.claudeStatus.state !== 'ready') { setCheckNote(`Claude is not ready: ${helper.claudeStatus.message}`); return; }
    const facts = await api.audit(f.id); if (!facts) { setCheckNote('frame did not answer'); return; } const surface = surfaceOf(f); const local = auditFacts(facts, surface); checkedFrame.current = f.id; setFindings(local.map((x) => ({ ...x, frame: f.id })));
    setCritiquing(true); setCheckNote(`${f.title}: ${local.length} local, asking Claude…`); let text = '', err = ''; const t0 = performance.now();
    await new Promise<void>((done) => c.say(CRITIQUE_SYSTEM, critiquePrompt(facts, surface === 'tv' ? 'TV screen' : surface === 'phone' ? 'phone screen' : 'desktop screen', local), (e) => { if (e.kind === 'delta') text += e.text; else { if (e.kind === 'error') err = e.text; done(); } }));
    setCritiquing(false); if (err && !text) { setCheckNote(`Claude failed: ${err}`); return; }
    const r = parseCritique(text, facts.nodes.map((n) => n.id)); setFindings([...local, ...r.findings].map((x) => ({ ...x, frame: f.id }))); setCheckNote(`${f.title}: ${local.length} local + ${r.findings.length} from Claude${r.rejected ? ` · ${r.rejected} rejected` : ''} · ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  };
  const checkAll = async () => { const api = window.__swift; if (!api) return; const t0 = performance.now(); const all: (Finding & { frame: string })[] = []; let bad = 0;
    for (const f of frames) { const facts = await api.audit(f.id); if (!facts) { bad++; continue; } for (const x of auditFacts(facts, surfaceOf(f))) all.push({ ...x, frame: f.id }); }
    setFindings(all); const by: Record<string, number> = {}; for (const x of all) { const f = frames.find((q) => q.id === x.frame); if (f) by[surfaceOf(f)] = (by[surfaceOf(f)] ?? 0) + 1; } const per = Object.entries(by).map(([k, v]) => `${k} ${v}`).join(', '); setCheckNote(`all ${frames.length} frames: ${all.length} finding${all.length === 1 ? '' : 's'}${per ? ` (${per})` : ''}${bad ? ` · ${bad} did not answer` : ''} · ${(performance.now() - t0).toFixed(0)} ms`); };
  const fixFinding = async (f: Finding & { frame: string }) => { if (!f.fix) return; await edit(f.frame, f.el, f.fix.prop, f.fix.value); setFindings((l) => l.filter((x) => x !== f)); }; // an ordinary edit: undoable, same op log
  const [brandTick, setBrandTick] = useState(0); const [pool, setPool] = useState<PoolStatus | null>(null); const [cmpId, setCmpId] = useState(''); const cmpKit = useMemo(() => (cmpId ? loadBrand(undefined, cmpId) : null), [cmpId, brand, brandTick]); // Brand board: the other project's kit, read-only until a token is shared
  const shareTokenTo = useCallback((name: string) => {
    if (!cmpId) return; const r = shareToken(loadBrand(undefined, cmpId), name, brand[name] ?? ''); if (!r.ok) { setSayStatus(r.error); return; }
    const err = saveBrand(r.kit, undefined, cmpId); const other = reg.list.find((p) => p.id === cmpId)?.name ?? cmpId; setSayStatus(err ? `Not shared: ${err}` : `Shared ${name} with ${other} (only that token)`); setBrandTick((n) => n + 1);
  }, [cmpId, brand, reg.list]);
  useEffect(() => { if (!frameMenuOpen) return; let alive = true; const tick = () => { void conn.current?.poolStatus().then((p) => { if (alive) setPool(p); }); }; tick(); const t = setInterval(tick, 3000); return () => { alive = false; clearInterval(t); }; }, [frameMenuOpen]); // Pulse: the Claude pool while the menu is open
  // Brand board: edit a colour token. Its old value becomes the new one in EVERY frame of this project (one undo group), the kit is saved, Say/Spark prompts use it from now on.
  const editTokens = useCallback(async (pairs: { name: string; value: string }[]) => {
    const api = window.__swift; if (!api || busy) return; const t0 = performance.now(); const ops: Op[] = []; let n = 0; let kit = { ...brand }; const done: string[] = [];
    for (const { name, value } of pairs) { const old = kit[name]; const v = value.trim(); if (old === undefined) continue; const colour = isColorValue(old);
      if (colour ? !isColorValue(v) : Object.keys(toBrandTokens([{ name, value: v }])).length === 0) { setSayStatus(`${name}: ${colour ? 'not a colour I can use' : 'not a plain value'}`); continue; } if (v.toLowerCase() === old.trim().toLowerCase()) continue;
      for (const id of api.frames) { const before = await api.snapshot(id); if (!before) continue;
        if (colour) { const r = replaceColor(before, old, v); if (r.count === 0) continue; await api.load(id, r.html); ops.push({ kind: 'snap', frame: id, before, after: r.html }); n += r.count; }
        else { const root = frames.find((f) => f.id === id)?.root; if (!root) continue; const r = await api.edit(id, root, name, v); if (!r.ok) continue; ops.push({ kind: 'snap', frame: id, before, after: await api.snapshot(id) }); n++; } } // a font or size token is a custom property on each frame root: the frame's own rules pick it up
      ops.push({ kind: 'brand', name, before: old, after: v }); kit = { ...kit, [name]: v }; done.push(name); }
    if (!done.length) return; const err = saveBrand(kit, undefined, project.id); setBrand(kit); recordOp(ops.length === 1 ? ops[0]! : { kind: 'group', label: `brand ${done.join(', ')}`, ops }); setRevision((x) => x + 1);
    const nf = ops.filter((o) => o.kind === 'snap').length; setSayStatus(err ? `Brand not saved: ${err}` : `${done.map((d) => `${d} → ${kit[d]}`).join(', ')}: ${n} place${n === 1 ? '' : 's'} in ${nf} frame${nf === 1 ? '' : 's'} · ${(performance.now() - t0).toFixed(0)} ms`);
  }, [brand, busy, project.id, recordOp, frames]);
  const editToken = useCallback((name: string, value: string) => editTokens([{ name, value }]), [editTokens]);
  editTokenRef.current = editToken; editTokensRef.current = editTokens;
  // Capture a running localhost page into a new frame (the helper renders it with Chrome; see helper/src/capture.rs).
  const captureUrl = useCallback(async (url: string, size: { w: number; h: number }, add: boolean, fullPage: boolean): Promise<CaptureOutcome> => {
    const c = conn.current; if (!c) return { message: 'The helper is offline', tokens: [] }; const r = await c.captureUrl(url, size); if (!r.ok) return { message: r.error, tokens: [] };
    if (!add) return { message: 'Opening as a project…', tokens: pageTokens(r.html), page: { html: r.html, url, size } };
    const f = capturedFrame(frames, r.html, url, size, fullPage); setFrames((x) => [...x, capturedFrame(x, r.html, url, size, fullPage)]);
    if (fullPage) setTimeout(() => { void window.__swift?.get(f.id, f.root, 'height').then((hh) => { const h = Math.min(8000, Math.ceil(parseFloat(hh ?? ''))); if (h > f.h) setFrames((x) => x.map((y) => (y.id === f.id ? { ...y, h } : y))); }); }, 700); // the page's real height, once it has laid out
    setTimeout(() => window.__swift?.fitTo([f.id]), fullPage ? 1200 : 300); return { message: `Added ${f.title} (${r.html.length >> 10} KB)`, tokens: pageTokens(r.html), page: { html: r.html, url, size } };
  }, [frames]);
  // Screenshot import: the image goes through the helper to the local Claude Code (vision); the rebuilt HTML takes the same path as a captured page.
  const importShot = useCallback(async (file: File, asProject: boolean): Promise<string> => {
    const c = conn.current; if (!c) return 'The helper is offline.';
    const shot = await readScreenshot(file); if (!shot.ok) return shot.error;
    if (helper.claudeStatus && helper.claudeStatus.state !== 'ready') return `Claude is not ready: ${helper.claudeStatus.message}`;
    const r = await rebuildScreenshot(c.say, shot.value); if (!r.ok) return r.error; const size = frameSizeFor(shot.value.size); const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'screenshot';
    if (asProject) { const next = addProject(reg, name); if (next && !reg.list.some((p) => p.id === next.active)) { const fr = capturedFrame([], r.html, name, size); saveDoc([{ ...fr, id: 'page-1', title: name }], undefined, next.active); } void goTo(next); return 'Opening as a project…'; }
    const f = capturedFrame(frames, r.html, name, size); setFrames((x) => [...x, capturedFrame(x, r.html, name, size)]); setTimeout(() => window.__swift?.fitTo([f.id]), 300); return `Added ${f.title} (${r.html.length >> 10} KB)`;
  }, [frames, helper.claudeStatus, reg, saveDoc, goTo]);
  const addFrame = useCallback((kind: PresetKey) => { const f = newFrame(frames, kind); setFrames((x) => [...x, newFrame(x, kind)]); setSayStatus(`Added ${f.title}`); setTimeout(() => window.__swift?.fitTo([f.id]), 200); }, [frames]);
  // Delete the selected frame (always keeps at least one); undo puts it back at the same place with its edits.
  const deleteFrame = useCallback(async () => {
    const id = selection?.frameId; const index = frames.findIndex((f) => f.id === id); const f = frames[index]; if (!id || !f || !window.__swift) return; if (frames.length <= 1) { setSayStatus('Cannot delete the last frame'); return; }
    const html = (await window.__swift.snapshot(id)) || f.html; recordOp({ kind: 'frameDel', frame: id, def: { ...f, html }, index });
    setFrames((x) => x.filter((y) => y.id !== id)); setSelection(null); setSayStatus(`Deleted ${f.title}`);
  }, [frames, selection]);
  // Project files: export everything as one portable JSON file, or open one as a NEW project (never overwrites an existing one).
  const exportProject = useCallback(async () => {
    if (!window.__swift) return; const snaps = await Promise.all(frames.map(async (f) => ({ ...f, html: (await window.__swift!.snapshot(f.id)) || f.html })));
    const url = URL.createObjectURL(new Blob([serializeProject(project.name, snaps, brand, logRef.current, motion)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = projectFileName(project.name); document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); setSayStatus(`Exported ${link.download}`);
  }, [frames, project.name, brand]);
  // Write the project into a repo folder (git-friendly: <folder>/.swift-canvas/project.json) via the helper; choosing the folder in the native dialog is the consent.
  const saveToRepo = useCallback(async () => {
    const c = conn.current; if (!c || !window.__swift) { setSayStatus('The helper is offline'); return; } const pick = await c.pickFolder(); if (!pick.ok) { if (pick.error !== 'cancelled') setSayStatus(`Not saved: ${pick.error}`); return; }
    const snaps = await Promise.all(frames.map(async (f) => ({ ...f, html: (await window.__swift!.snapshot(f.id)) || f.html }))); const r = await c.writeRepo(pick.path, serializeProject(project.name, snaps, brand, logRef.current, motion)); setSayStatus(r.ok ? `Saved ${r.path}` : `Not saved: ${r.error}`);
  }, [frames, project.name, brand]);
  const [repoPlan, setRepoPlan] = useState<{ path: string; files: RepoFile[]; branch: string; entries: RepoEntry[] } | null>(null);
  const planRepoExport = async () => { // pick a folder, then PREVIEW the paths before anything is written; the branch is only made on the second click
    const c = conn.current; if (!c || !window.__swift) { setSayStatus('The helper is offline'); return; } const pick = await c.pickFolder(); if (!pick.ok) { if (pick.error !== 'cancelled') setSayStatus(`Not exported: ${pick.error}`); return; }
    const snaps = await Promise.all(frames.map(async (f) => ({ ...f, html: (await window.__swift!.snapshot(f.id)) || f.html }))); const used = new Set<string>();
    const files: RepoFile[] = snaps.map((f) => { let n = exportName(f.title); for (let i = 2; used.has(n); i++) n = exportName(f.title).replace(/\.html$/, `-${i}.html`); used.add(n); return { path: `swift-canvas/${n}`, content: exportDoc(f.title, f.html) }; }); for (const f of snaps) { let n = componentName(f.title); for (let i = 2; used.has(`${n}.tsx`); i++) n = `${componentName(f.title)}${i}`; used.add(`${n}.tsx`); files.push({ path: `swift-canvas/${n}.tsx`, content: frameToTsx(f.title, f.html) }); } files.push({ path: 'swift-canvas/project.json', content: serializeProject(project.name, snaps, brand, logRef.current, motion) });
    const r = await c.repoCall('plan', pick.path, project.name, files); if (!r.ok) { setSayStatus(`Not exported: ${r.error}`); return; } setRepoPlan({ path: pick.path, files, branch: r.branch, entries: r.entries ?? [] });
  };
  const confirmRepoExport = async () => { const pl = repoPlan; const c = conn.current; if (!pl || !c) return; const r = await c.repoCall('export', pl.path, project.name, pl.files); setRepoPlan(null); setSayStatus(r.ok ? `Committed ${pl.files.length} files on branch ${r.branch}; your current branch is untouched (undo: git branch -D ${r.branch})` : `Not exported: ${r.error}`); };
  const openProjectFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_BYTES) { setSayStatus('Project file too large'); return; } const r = parseProjectFile(await file.text()); if (!r.ok) { setSayStatus(`Cannot open ${file.name}: ${r.error}`); return; }
    const next = addProject(reg, uniqueName(reg.list, r.project.name)); if (!next) { setSayStatus('Too many projects'); return; }
    const e1 = saveDoc(r.project.frames, undefined, next.active, r.project.log ?? undefined); if (e1) { setSayStatus(`Not opened: ${e1}`); return; } saveBrand(r.project.brand, undefined, next.active); if (r.project.motion) saveTimeline(next.active, r.project.motion); void goTo(next);
  }, [reg, goTo]);
  // Shared library: save the selected element (markup + origin project), insert it into any frame later (ids de-duplicated, one undo step).
  const saveToLibrary = useCallback(async () => {
    if (!selection || !window.__swift) return; const html = (await window.__swift.styled(selection.frameId, selection.el, brand)) || (await window.__swift.outer(selection.frameId, selection.el)); /* portable: computed look inlined, brand colours as var(--token, colour) */ const r = addItem(library, selection.el, project.name, html, brand);
    if (!r.ok) { setSayStatus(`Library: ${r.error}`); return; } const err = saveLibrary(r.list); setLibrary(r.list); setSayStatus(err ? `Saved for now, not stored: ${err}` : `Saved #${selection.el} to the library`);
  }, [selection, library, project.name, brand]);
  const insertFromLibrary = useCallback(async (item: LibItem) => {
    const api = window.__swift; const f = frames.find((x) => x.id === (selection?.frameId ?? frames[0]?.id)); if (!api || !f) return;
    const taken = new Set((await api.tree(f.id)).map((n) => n.id)); const tRe = performance.now(); const unique = uniquifyIds(item.html, taken); const rt = item.origin !== project.name && item.tokens ? retheme(unique, item.tokens, brand) : { html: unique, mapped: 0 }; const reMs = performance.now() - tRe; const html = rt.html; const snapshot = await api.snapshot(f.id);
    if (!(await api.add(f.id, f.root, html))) { setSayStatus(`Could not insert ${item.name}`); return; }
    recordOp({ kind: 'snap', frame: f.id, before: snapshot, after: await api.snapshot(f.id) }); setRevision((n) => n + 1); setSayStatus(`Inserted ${item.name} (from ${item.origin}) into ${f.title}${rt.mapped ? ` · re-themed ${rt.mapped} colour${rt.mapped === 1 ? '' : 's'} in ${reMs.toFixed(1)} ms` : ''}`);
  }, [frames, selection, project.name, brand]);
  // Export the selected frame (or the TV frame when nothing is selected) as a standalone HTML file.
  const exportReact = useCallback(async () => {
    const f = frames.find((x) => x.id === (selection?.frameId ?? frames[0]?.id ?? '')) ?? frames[0]; if (!f || !window.__swift) return; const html = await window.__swift.snapshot(f.id); if (!html) { setSayStatus('Could not export: frame not ready'); return; }
    const url = URL.createObjectURL(new Blob([frameToTsx(f.title, html)], { type: 'text/plain' })); const link = document.createElement('a'); link.href = url; link.download = `${componentName(f.title)}.tsx`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); setSayStatus(`Exported ${link.download} (inline styles; Tailwind classes are not generated)`);
  }, [frames, selection]);
  const exportFrame = useCallback(async () => {
    const f = frames.find((x) => x.id === (selection?.frameId ?? frames[0]?.id ?? '')) ?? frames[0]; if (!f || !window.__swift) return; const html = await window.__swift.snapshot(f.id); if (!html) { setSayStatus('Could not export: frame not ready'); return; }
    const url = URL.createObjectURL(new Blob([exportDoc(f.title, html)], { type: 'text/html' })); const link = document.createElement('a'); link.href = url; link.download = exportName(f.title); document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); setSayStatus(`Exported ${link.download}`);
  }, [frames, selection]);
  // Enter selects the first child, Shift+Enter the parent (outside inputs and buttons, where Enter has its own meaning).
  useEffect(() => {
    const k = async (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !selection || e.metaKey || e.ctrlKey || e.altKey) return; const t = e.target; if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLButtonElement) return;
      const tree = await window.__swift?.tree(selection.frameId); if (!tree) return; const next = e.shiftKey ? parentOf(tree, selection.el) : firstChild(tree, selection.el); if (next) setSelection({ frameId: selection.frameId, el: next });
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [selection]);
  const nudgeChain = useRef<Promise<void>>(Promise.resolve());
  // Arrow keys nudge the selected element (Shift = 10 px) when it is positioned (static elements are left alone).
  useEffect(() => {
    const k = async (e: KeyboardEvent) => {
      if (!selection || !e.key.startsWith('Arrow') || e.metaKey || e.ctrlKey || e.altKey) return; const t = e.target; if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (extras.length) { // several elements: each key press moves them all, ONE undo step per press (snapshot pair)
        const key = e.key, shift = e.shiftKey, sel = selection, els = [sel.el, ...extras]; nudgeChain.current = nudgeChain.current.then(async () => { const api = window.__swift; if (!api) return; const before = await api.snapshot(sel.frameId); let moved = 0;
          for (const el of els) { const props = await api.props(sel.frameId, el, ['position', 'left', 'top', 'translate']); const n = props ? nudge(props, key, shift) : null; if (n) { const r = await api.edit(sel.frameId, el, n.prop, n.value); if (r.ok) moved++; } }
          if (moved) { recordOp({ kind: 'snap', frame: sel.frameId, before, after: await api.snapshot(sel.frameId) }); setRevision((x) => x + 1); } }); return; } const key = e.key, shift = e.shiftKey, sel = selection; // serialized: each nudge reads the position AFTER the previous one landed (held keys repeat faster than a round trip)
      nudgeChain.current = nudgeChain.current.then(async () => { const props = await window.__swift?.props(sel.frameId, sel.el, ['position', 'left', 'top', 'translate']); if (!props) return; const n = nudge(props, key, shift); if (!n) return; await edit(sel.frameId, sel.el, n.prop, n.value, true, true); });
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [selection, extras, edit, recordOp]);
  // Click selects one element; shift-click adds or removes one in the same frame (the primary is the first).
  const pickElement = useCallback(async (s: Sel | null, additive?: boolean) => {
    if (playFlow && s) { const api = window.__swift; const tree = api ? await api.tree(s.frameId) : []; const chain = [s.el]; for (let p = parentOf(tree, s.el); p; p = parentOf(tree, p)) chain.push(p); const hit = follow(links, s.frameId, chain); if (hit && api) { flowBack.current.push(s.frameId); api.fitTo([hit.to]); setSayStatus(`→ ${frames.find((f) => f.id === hit.to)?.title ?? hit.to}`); } else setSayStatus('No link here'); return; } // Play: clicks follow links, nothing is selected
    if (!additive || !s || !selection || s.frameId !== selection.frameId) { if (!additive || s) setSelection(s); return; }
    const all = [selection.el, ...extras]; const next = all.includes(s.el) ? all.filter((e) => e !== s.el) : [...all, s.el]; const [first, ...rest] = next;
    if (!first) { setSelection(null); return; } setSelection({ frameId: s.frameId, el: first }); setXs({ key: `${s.frameId}/${first}`, els: rest });
  }, [selection, extras, playFlow, links, frames]);
  // Drag the selected (positioned) element: live left/top edits while dragging, ONE undo step for the whole drag (a snapshot taken at the start).
  const moving = useRef<{ frameId: string; items: { el: string; start: MoveStart }[]; snapshot: string; raf: number } | null>(null);
  const moveElement = useCallback(async (frameId: string, el: string, dx: number, dy: number, phase: 'start' | 'move' | 'end') => {
    const api = window.__swift; if (!api) return;
    if (phase === 'start') { moving.current = null; const els = [el, ...extras.filter((x) => x !== el)]; const [snapshot, ...all] = await Promise.all([api.snapshot(frameId), ...els.map((e) => api.props(frameId, e, ['position', 'left', 'top', 'translate']))]);
      const items = els.flatMap((e, i) => { const st = all[i] ? moveStart(all[i]!) : null; return st ? [{ el: e, start: st }] : []; }); if (items.length) moving.current = { frameId, items, snapshot: snapshot as string, raf: 0 }; return; } // the whole selection moves together; elements that cannot move stay put
    const m = moving.current; if (!m) return;
    if (phase === 'move') { for (const it of m.items) for (const e of moveEdits(it.start, dx, dy)) void api.edit(m.frameId, it.el, e.prop, e.value); if (!m.raf) m.raf = requestAnimationFrame(() => { m.raf = 0; setRevision((n) => n + 1); }); return; }
    cancelAnimationFrame(m.raf); moving.current = null; recordOp({ kind: 'snap', frame: m.frameId, before: m.snapshot, after: await api.snapshot(m.frameId) }); setRevision((n) => n + 1);
  }, [extras.length]);
  // Resize with the bottom-right handle: live width/height, ONE undo step (start snapshot), 4 px floor.
  const resizing = useRef<{ frameId: string; el: string; start: { w: number; h: number }; snapshot: string; raf: number } | null>(null);
  const resizeElement = useCallback(async (frameId: string, el: string, dw: number, dh: number, phase: 'start' | 'move' | 'end') => {
    const api = window.__swift; if (!api) return;
    if (phase === 'start') { resizing.current = null; const [props, snapshot] = await Promise.all([api.props(frameId, el, ['width', 'height']), api.snapshot(frameId)]); const w = parseFloat(props?.width ?? ''), h = parseFloat(props?.height ?? ''); if (Number.isFinite(w) && Number.isFinite(h)) resizing.current = { frameId, el, start: { w, h }, snapshot, raf: 0 }; return; }
    const m = resizing.current; if (!m) return;
    if (phase === 'move') { const s = resizedSize(m.start, dw, dh); void api.edit(m.frameId, m.el, 'width', s.width); void api.edit(m.frameId, m.el, 'height', s.height); if (!m.raf) m.raf = requestAnimationFrame(() => { m.raf = 0; setRevision((n) => n + 1); }); return; }
    cancelAnimationFrame(m.raf); resizing.current = null; recordOp({ kind: 'snap', frame: m.frameId, before: m.snapshot, after: await api.snapshot(m.frameId) }); setRevision((n) => n + 1);
  }, []);
  // Delete / Backspace removes the selected element (never a frame root); one snapshot makes it one undo step.
  const removeSelected = useCallback(async () => {
    if (!selection || !window.__swift) return; const f = frames.find((x) => x.id === selection.frameId); if (!f || f.root === selection.el) return;
    const snapshot = await window.__swift.snapshot(selection.frameId); const gone: string[] = []; for (const el of [selection.el, ...extras]) { if (el === f.root) continue; if (!(await window.__swift.remove(selection.frameId, el))) { setSayStatus(`Could not remove #${el}`); break; } gone.push(el); } if (!gone.length) return;
    recordOp({ kind: 'snap', frame: selection.frameId, before: snapshot, after: await window.__swift.snapshot(selection.frameId) }); setSelection(null); setRevision((n) => n + 1); setSayStatus(`Removed ${gone.map((e) => '#' + e).join(', ')}`);
  }, [selection, extras, frames]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.key !== 'Delete' && e.key !== 'Backspace') || e.metaKey || e.ctrlKey || e.altKey) return; const t = e.target; if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return; e.preventDefault(); void removeSelected(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [removeSelected]);
  // Suggestion chips for the selection: what its computed style allows, answered by the local tier.
  const [selProps, setSelProps] = useState<SuggestProps | null>(null);
  useEffect(() => { let alive = true; setSelProps(null); if (!selection) return; void window.__swift?.props(selection.frameId, selection.el, ['font-size', 'font-weight', 'opacity']).then((p) => { if (alive && p) setSelProps(p as SuggestProps); }); return () => { alive = false; }; }, [selection, revision]);
  const chips = useMemo(() => (selProps ? suggestions(selProps, brand) : []), [selProps, brand]);
  // Zoom readout (the viewport lives in a ref, not React state: poll it a few times a second); click = actual size.
  const [zoomPct, setZoomPct] = useState(100);
  useEffect(() => { const t = setInterval(() => { const v = window.__swift?.view(); if (v) setZoomPct((p) => { const n = Math.round(v.s * 100); return p === n ? p : n; }); }, 250); return () => clearInterval(t); }, []);
  const actualSize = useCallback(() => { const r = document.querySelector('[data-testid=canvas]')?.getBoundingClientRect(); const v = window.__swift?.view(); if (r && v && window.__swift) window.__swift.setView(zoomAt(v, r.width / 2, r.height / 2, 1 / v.s)); }, []);
  const [lens, setLens] = useState<(typeof LENSES)[number]>('Design');
  useEffect(() => { const c = connectHelper(TOKEN, setHelper); conn.current = c; return c.close; }, []);
  // In-app MCP server (#1712): the helper relays design-op calls from Claude Code sessions here; a batch = ONE undo step. The ref keeps the handler on the latest state.
  const mcpEnv = useRef<McpEnv | null>(null); mcpEnv.current = { api: window.__swift, frames, selection, record: recordOp, bump: () => setRevision((n) => n + 1), undo: async () => { if (!L.canUndo(logRef.current)) return false; await undo(); return true; } };
  useEffect(() => { conn.current?.setMcpHandler((tool, args) => handleMcp(mcpEnv.current!, tool, args)); }, []);
  const dot = helper.status === 'connected' ? (helper.claudeStatus && helper.claudeStatus.state !== 'ready' ? 'warn' : 'ok') : helper.status === 'connecting' ? 'warn' : 'bad';
  return (
    <div className={`kit-root m-${mode}`} style={vars as CSSProperties}>
      <header className="kit-top">
        <div className="gl isl" aria-label="Project">
          <span className="mark" aria-hidden>⚡</span>
          <button ref={pjRef} className="rb pj pjbtn" aria-haspopup="dialog" aria-expanded={importOpen} data-testid="project-button" onClick={() => setImportOpen((o) => !o)}><b>{project.name}</b><span className="mono mu">{frames.length} {frames.length === 1 ? 'frame' : 'frames'}</span></button>
          <button ref={swatchRef} className="rb swatch" aria-label="Appearance" aria-haspopup="dialog" aria-expanded={appearanceOpen} data-testid="appearance-button" style={{ backgroundImage: backdropThumb(theme.bd) }} onClick={() => setAppearanceOpen((o) => !o)} />
        </div>
        {importOpen && conn.current && <ImportProject onCreatePage={(page, t) => { let host = page.url; try { host = new URL(page.url).host; } catch { /* keep text */ } const next = addProject(reg, host); if (next && !reg.list.some((p) => p.id === next.active)) { const fr = capturedFrame([], page.html, page.url, page.size); saveDoc([{ ...fr, id: 'page-1', title: host }], undefined, next.active); } if (next) saveBrand(t, undefined, next.active); void goTo(next); }} capture={captureUrl} screenshot={importShot} scan={conn.current.scan} pick={conn.current.pickFolder} projects={reg.list} kits={Object.fromEntries(reg.list.map((p) => [p.id, kitColors(p.id === project.id ? brand : loadBrand(undefined, p.id))]))} active={project.id} onSwitch={(id) => void goTo(switchProject(reg, id))} onCreate={(name, t) => { const next = addProject(reg, name); if (next && !reg.list.some((p) => p.id === next.active)) { saveDoc(starterFrames(name, t), undefined, next.active); } if (next) saveBrand(t, undefined, next.active); void goTo(next); }} using={Object.keys(brand).length} onUse={(t) => { const err = saveBrand(t, undefined, project.id); setBrand(t); if (err) setSayStatus(`Brand not saved: ${err}`); }} onClose={() => { setImportOpen(false); pjRef.current?.focus(); }} />}
        <input ref={moodFile} type="file" accept="image/*" hidden data-testid="mood-input" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addMoodImage(f); }} />
        <input ref={fileRef} type="file" accept=".json,application/json" hidden data-testid="project-file-input" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setFrameMenuOpen(false); void openProjectFile(f); } }} />
        {frameMenuOpen && (<>
          <div className="scrim" onClick={() => { setFrameMenuOpen(false); fmRef.current?.focus(); }} aria-hidden="true" />
          <div className="gl pop framemenu" role="dialog" aria-label="Frame" data-testid="frame-popover" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setFrameMenuOpen(false); fmRef.current?.focus(); } }}>
            <h2>New frame</h2>
            <div className="projs">{(Object.keys(PRESETS) as PresetKey[]).map((k) => <button key={k} className="rb btn" onClick={() => { addFrame(k); setFrameMenuOpen(false); }} data-testid={`add-${k}`} title={`New ${PRESETS[k].label} frame`}>+ {k}</button>)}</div>
            <h2>Selected frame</h2>
            <div className="projs">
              <button className="rb btn" onClick={() => { setFrameMenuOpen(false); if (cmp) window.__swift?.fitTo(cmp); }} disabled={!cmp} data-testid="compare" title="Show the selected take or copy next to its original">Compare with original</button>
              <button className="rb btn" onClick={() => void whatChanged()} disabled={!cmp} data-testid="what-changed" title="List the elements and properties that differ from the original">What changed</button>
              <button className="rb btn" onClick={() => { setFrameMenuOpen(false); void exportFrame(); }} data-testid="export">Export HTML</button><button className="rb btn" onClick={() => { setFrameMenuOpen(false); void exportReact(); }} data-testid="export-react" title="The selected frame as a React component (TSX), element ids kept">Export React</button>
              <button className="rb btn" onClick={() => { setFrameMenuOpen(false); void deleteFrame(); }} disabled={!selection} data-testid="delete-frame" title="Delete the selected frame (undoable)">Delete frame</button>
            </div>
            <h2>Library <span className="mono mu">shared across projects</span></h2>
            <div className="projs"><button className="rb btn" onClick={() => void saveToLibrary()} disabled={!selection} data-testid="lib-save">Save selection</button></div>
            {origins(library).length > 1 && <div className="projs" role="group" aria-label="Filter by project" data-testid="lib-filters"><button className={`rb btn${libFilter === null ? ' on' : ''}`} aria-pressed={libFilter === null} onClick={() => setLibFilter(null)}>All</button>{origins(library).map((o) => <button key={o} className={`rb btn${libFilter === o ? ' on' : ''}`} aria-pressed={libFilter === o} onClick={() => setLibFilter(o)} data-testid={`lib-filter-${o}`}>{o}</button>)}</div>}
            <ul className="liblist" data-testid="library">{filterItems(library, libFilter).slice(0, 12).map((it) => (<li key={it.id} className="libitem"><button className="rb btn" onClick={() => { setFrameMenuOpen(false); void insertFromLibrary(it); }} data-testid="lib-item" title={`Insert into the selected frame`}>{it.name}<span className="mono mu"> · {it.origin}</span></button><button className="rb btn libx" aria-label={`Remove ${it.name} from the library`} data-testid="lib-remove" onClick={() => dropFromLibrary(it.id)}>✕</button></li>))}{library.length === 0 && <li className="mu">Nothing saved yet.</li>}</ul>
            <h2>Moodboard <span className="mono mu">steers Spark, this project</span></h2>
            <div className="projs"><button className="rb btn" onClick={() => moodFile.current?.click()} disabled={mood.length >= 8} data-testid="mood-add">Add image…</button></div>
            <ul className="liblist" data-testid="moodboard">{mood.map((r) => (<li key={r.id} className="libitem" data-testid="mood-ref">{r.dataUrl && <img src={r.dataUrl} alt="" width={40} height={28} style={{ objectFit: 'cover', borderRadius: 4 }} />}<span className="mono mu"> {r.name} {r.colors.slice(0, 3).map((c) => <span key={c} style={{ background: c, display: 'inline-block', width: 10, height: 10, borderRadius: 5 }} />)}</span>{r.dataUrl && <button className="rb btn" disabled={typeBusy === r.id || helper.status !== 'connected'} onClick={() => void describeType(r.id)} data-testid="mood-type" title="Ask Claude to describe this reference's typography; the note steers Spark (uses a little subscription)">{typeBusy === r.id ? 'Reading…' : r.note ? 'Redo type' : 'Describe type'}</button>}<button className="rb btn" onClick={() => changeMood(removeRef(mood, r.id))} aria-label={`Remove ${r.name}`} data-testid="mood-remove">✕</button>{r.note && <div className="mono mu" data-testid="mood-note">{r.note}</div>}</li>))}</ul>
            <h2>Branches <span className="mono mu">on {logRef.current.current}</span></h2>
            <div className="projs"><button className="rb btn" onClick={forkHere} disabled={busy} data-testid="fork" title="Start a branch here; main stays as it is">Fork here</button><button className="rb btn" onClick={() => void branchFromTake()} disabled={busy || !cmp} data-testid="branch-take" title="Branch from the selected take (B): the original frame shows this take on the new branch">Branch from take (B)</button><button className="rb btn" onClick={keepBranch} disabled={logRef.current.current === L.MAIN} data-testid="keep-branch" title="Make main include this branch">Keep this branch</button></div>
            {mergeAsk && <div data-testid="merge-sheet"><p className="mono mu">Both sides changed these. Choose for each, then merge {mergeAsk.name}.</p><ul className="liblist">{mergeAsk.conflicts.map((c) => (<li key={c.key} className="libitem mono" data-testid="merge-conflict"><span>{c.key}</span> <span className="mu">main: {c.ours} · {mergeAsk.name}: {c.theirs}</span> <button className="rb btn" aria-pressed={mergeAsk.picks[c.key] === 'ours'} onClick={() => setMergeAsk({ ...mergeAsk, picks: { ...mergeAsk.picks, [c.key]: 'ours' } })} data-testid="pick-ours">Keep main</button><button className="rb btn" aria-pressed={mergeAsk.picks[c.key] === 'theirs'} onClick={() => setMergeAsk({ ...mergeAsk, picks: { ...mergeAsk.picks, [c.key]: 'theirs' } })} data-testid="pick-theirs">Take branch</button></li>))}</ul><div className="projs"><button className="rb btn" onClick={() => void doMerge(mergeAsk.name, mergeAsk.picks)} disabled={mergeAsk.conflicts.some((c) => !mergeAsk.picks[c.key])} data-testid="merge-apply">Merge</button><button className="rb btn" onClick={() => setMergeAsk(null)} data-testid="merge-cancel">Cancel</button></div></div>}
            <ul className="liblist" data-testid="branches">{Object.keys(logRef.current.branches).map((n) => (<li key={n} className="libitem" data-testid="branch"><button className="rb btn" onClick={() => void switchBranch(n)} disabled={busy || n === logRef.current.current} data-testid="branch-switch">{n}{n === logRef.current.current ? ' · current' : ''}</button>{canMerge(logRef.current, n) && <button className="rb btn" onClick={() => void doMerge(n)} disabled={busy} data-testid="branch-merge" title={`Merge ${n} into ${logRef.current.current}`}>Merge</button>}{n !== L.MAIN && <button className="rb btn" onClick={() => dropBranch(n)} aria-label={`Delete ${n}`} data-testid="branch-del">✕</button>}</li>))}</ul>
            <h2>Brand <span className="mono mu">this project</span></h2>
            <label className="mono mu">Compare with <select aria-label="Compare kit with" data-testid="brand-compare" value={cmpId} onChange={(e) => setCmpId(e.target.value)}><option value="">nothing</option>{reg.list.filter((p) => p.id !== project.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            {cmpKit && <ul className="liblist" data-testid="brand-diff">{compareKits(brand, cmpKit).map((r) => (<li key={r.name} className="libitem" data-testid="brand-diff-row" data-state={r.state}><span className="mono">{r.name}</span><span className="mu mono"> {r.state === 'same' ? 'same' : r.state === 'differs' ? `${r.a} ≠ ${r.b}` : r.state === 'only-a' ? 'only here' : `only there: ${r.b}`}</span>{r.a !== undefined && r.state !== 'same' && <button type="button" className="rb btn" data-testid="brand-share" onClick={() => shareTokenTo(r.name)} title="Copy this one token to the other project">Share →</button>}</li>))}</ul>}
            <input ref={dtcgFile} type="file" accept=".json,application/json" hidden data-testid="dtcg-input" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importDtcg(f); }} />
            <div className="projs"><button className="rb btn" onClick={exportDtcg} data-testid="dtcg-export" title="The kit as a Design Tokens (DTCG) file for Style Dictionary, Terrazzo, Tokens Studio">Export tokens.json</button><button className="rb btn" onClick={() => dtcgFile.current?.click()} data-testid="dtcg-import" title="Merge a Design Tokens (DTCG) file into this kit">Import tokens…</button></div>
            <ul className="liblist" data-testid="brand-kit">{Object.entries(brand).map(([name, val]) => (<li key={name} className="libitem" data-testid="brand-token"><span className="mono">{name}</span> {/^#[0-9a-f]{3,8}$/i.test(val) ? <input type="color" aria-label={`Edit ${name}`} data-testid="brand-color" value={/^#[0-9a-f]{6}$/i.test(val) ? val : '#808080'} onChange={(e) => void editToken(name, e.target.value)} title="Changes this colour in every frame" /> : null}{!/^#[0-9a-f]{3,8}$/i.test(val) ? <input key={val} className="mono" aria-label={`Edit ${name} as text`} data-testid="brand-text" defaultValue={val} onKeyDown={(e) => { if (e.key === 'Enter') void editToken(name, e.currentTarget.value); }} title="Type a new value (a colour, a size like 16px, a font family) and press Enter" /> : null}{/^#[0-9a-f]{3,8}$/i.test(val) ? <span className="mu mono"> {val}</span> : null}</li>))}</ul>
            <p className="mono mu" data-testid="pool">{pool ? `Claude pool: ${pool.running}/${pool.max} running · ${pool.spare ? 'warm spare ready' : 'no spare'}${pool.availableMb != null ? ` · ${(pool.availableMb / 1024).toFixed(1)} GB free (floor ${(pool.minFreeMb / 1024).toFixed(1)} GB)` : ''}` : 'Claude pool: helper offline'}</p>
            {repoPlan && <><h2>Export preview <span className="mono mu">{repoPlan.branch}</span></h2><ul className="liblist" data-testid="repo-plan">{repoPlan.entries.map((e) => (<li key={e.path} className="libitem mono" data-testid="repo-plan-row" data-state={e.status}>{e.status} · {e.path}</li>))}</ul><div className="projs"><button className="rb btn" onClick={() => void confirmRepoExport()} data-testid="repo-confirm">Create branch</button><button className="rb btn" onClick={() => setRepoPlan(null)} data-testid="repo-cancel">Cancel</button></div></>}
            {mixOptions.length > 0 && <div className="projs"><select aria-label="Mix with" data-testid="mix-with" value={mixWith} onChange={(e) => setMixWith(e.target.value)}><option value="">Mix this take with…</option>{mixOptions.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}</select><button className="rb btn" data-testid="mix" disabled={!mixWith} onClick={() => void mixTakes()} title="A new copy: this take plus what the other take changed that this one left alone (no model)">Mix</button></div>}
            <ul className="liblist" data-testid="devices">{(['tv', 'phone', 'desktop'] as const).map((k) => { const ids = frames.filter((f) => surfaceOf(f) === k).map((f) => f.id); return ids.length ? (<li key={k} className="libitem mono" data-testid="device-row" data-surface={k}>{k} <span className="mu">{ids.length} frame{ids.length === 1 ? '' : 's'}</span><button className="rb btn" onClick={() => { setFrameMenuOpen(false); window.__swift?.fitTo(ids); }} data-testid="device-show">Show</button></li>) : null; })}</ul>
            <label className="mono mu"><input type="checkbox" checked={chrome} onChange={(e) => setChrome(e.target.checked)} data-testid="device-chrome" /> Device chrome (bezels on the canvas, not in exports)</label>
            <h2>Crew <span className="mono mu">{crewSet.crew.length} designers{crewSet.overridden.length ? ` · ${crewSet.overridden.length} overridden` : ''}</span></h2>
            <ul className="liblist" data-testid="crew">{crewSet.crew.map((s) => (<li key={s.codename} className="libitem" data-testid="crew-member" data-codename={s.codename}><span className="mono">{s.codename}</span> <span className="mu">{s.role} · {s.voice}</span>{crewSet.overridden.includes(s.codename) && <span className="mono mu"> · from the project</span>}<div className="mono mu">{s.rules.map((r) => r.text).join(' · ')}</div></li>))}</ul>
            {crewSet.errors.length > 0 && <ul className="liblist" data-testid="crew-errors">{crewSet.errors.map((e) => (<li key={e} className="mono" data-testid="crew-error">{e}</li>))}</ul>}
            <div className="projs"><button className="rb btn" onClick={() => void loadCrewFolder()} data-testid="crew-load" title="Read .swift-canvas/crew/*.md from a project folder; its sheets add to or replace the bundled five">Load crew from folder…</button></div>
            <div className="projs"><button className="rb btn" data-testid="spark-12" disabled={sparking || helper.status !== 'connected'} onClick={() => { setFrameMenuOpen(false); void spark(12); }} title={`12 directions at once (${tokensShort((e => e.input + e.output)(estimateSpark(usage, 12)))} tokens estimated, about 3 GB of memory for the sessions; at most 4 run at a time)`}>Spark ×12</button></div>
            <h2>Alternates <span className="mono mu">{selection ? `${selection.el}: ${altCount(alts, selKeyAlt)} saved` : 'select an element'}</span></h2>
            <div className="projs"><button className="rb btn" data-testid="alt-save" disabled={!selection} onClick={() => void saveAlt()} title="Save the selected element's current look as a variant">Save variant</button><button className="rb btn" data-testid="alt-next" disabled={!selection || altCount(alts, selKeyAlt) < 2} onClick={() => void nextAlt(1)} title="Next variant (V)">Next (V)</button><button className="rb btn" data-testid="alt-keep" disabled={!selection || altCount(alts, selKeyAlt) === 0} onClick={keepAlt} title="Keep the look on screen and forget the others">Keep this</button></div>
            <h2>Prototype <span className="mono mu">{links.length} link{links.length === 1 ? '' : 's'}{playFlow ? ' · playing' : ''}</span></h2>
            <div className="projs"><select aria-label="Link target" data-testid="link-to" value={linkTo} onChange={(e) => setLinkTo(e.target.value)}><option value="">Link to…</option>{frames.filter((f) => f.id !== selection?.frameId).map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}</select><button className="rb btn" data-testid="link-add" disabled={!selection || !linkTo} onClick={() => { if (!selection) return; const r = addLink(links, { frame: selection.frameId, el: selection.el, to: linkTo }); if (!r.ok) { setSayStatus(r.error); return; } setLinks(r.links); setSayStatus(`${selection.el} → ${frames.find((f) => f.id === linkTo)?.title}`); }}>Link selected</button><button className="rb btn" data-testid="flow-play" aria-pressed={playFlow} onClick={() => { setPlayFlow((p) => !p); flowBack.current = []; setSelection(null); setFrameMenuOpen(false); }}>{playFlow ? 'Stop' : 'Play'}</button><button className="rb btn" data-testid="flow-back" disabled={!playFlow} onClick={() => { const b = flowBack.current.pop(); if (b) window.__swift?.fitTo([b]); }}>Back</button></div>
            <ul className="liblist" data-testid="links">{links.map((x) => (<li key={`${x.frame}/${x.el}`} className="libitem mono" data-testid="link-row">{x.frame}/{x.el} → {x.to}<button className="rb btn" aria-label="Remove link" onClick={() => setLinks(removeLink(links, x))}>✕</button></li>))}</ul>
            <h2>Motion <span className="mono mu">{motion.tracks.length} animated · {motion.duration} ms</span></h2>
            <div className="projs"><input type="range" aria-label="Time" data-testid="motion-time" min={0} max={motion.duration} step={10} value={mt} onChange={(e) => void scrub(Number(e.target.value))} /><span className="mono mu" data-testid="motion-t">{Math.round(mt)} ms</span><button className="rb btn" data-testid="motion-play" onClick={() => { if (mt >= motion.duration) setMt(0); setPlaying((p) => !p); }}>{playing ? 'Stop' : 'Play'}</button></div>
            <div className="projs"><select aria-label="Property" data-testid="motion-prop" value={mProp} onChange={(e) => setMProp(e.target.value)}>{['opacity', 'translate', 'left', 'top', 'width', 'height', 'font-size', 'color', 'background-color'].map((p) => <option key={p}>{p}</option>)}</select><select aria-label="Ease" data-testid="motion-ease" value={mEase} onChange={(e) => setMEase(e.target.value as Ease)}>{EASES.map((x) => <option key={x}>{x}</option>)}</select><button className="rb btn" data-testid="motion-key" onClick={() => void addKey()} disabled={!selection}>Key here</button><button className="rb btn" data-testid="motion-ease-apply" onClick={easeSel} disabled={!selection}>Ease</button><button className="rb btn" data-testid="motion-render" onClick={() => void renderMotion()} disabled={rendering || !motion.tracks.length} title="Render the timeline to an MP4 (30 fps) with the helper: headless Chrome + ffmpeg">{rendering ? `Rendering ${renderPct}` : 'Render MP4'}</button>{rendering && <button className="rb btn" data-testid="motion-render-cancel" onClick={() => renderAbort.current?.abort()}>Cancel</button>}<button className="rb btn" data-testid="motion-clear" onClick={() => setMotion(emptyTimeline(motion.duration))} disabled={!motion.tracks.length}>Clear</button></div>
            <ul className="liblist" data-testid="motion-tracks">{motion.tracks.map((x) => (<li key={`${x.frame}/${x.el}/${x.prop}`} className="libitem mono" data-testid="motion-track">{x.el}.{x.prop} <span className="mu">{x.keys.map((k) => `${k.t}ms ${k.v}`).join(' → ')}</span></li>))}</ul>
            {changes && <><h2>Changed <span className="mono mu">{changes.pair}</span></h2><ul className="liblist" data-testid="changes">{changes.list.length === 0 ? <li className="mono mu">identical</li> : changes.list.map((c) => (<li key={c.el} className="libitem mono" data-testid="change" data-kind={c.kind}>{c.el} <span className="mu">{c.kind}{c.props.length ? `: ${c.props.join(', ')}` : ''}</span></li>))}</ul></>}
            <h2>Effects budget <span className="mono mu">estimate</span></h2>
            <div className="projs"><select aria-label="Device" data-testid="fx-device" value={fxDevice} onChange={(e) => setFxDevice(e.target.value as Device)}><option value="tv">TV</option><option value="phone">Phone</option><option value="desktop">Desktop</option></select><button className="rb btn" data-testid="fx-aurora" onClick={() => void addFx('aurora')}>+ Aurora</button><button className="rb btn" data-testid="fx-heavy" onClick={() => void addFx('heavy')}>+ Heavy</button><button className="rb btn" data-testid="fx-grain" onClick={() => void addFx('grain')}>+ Grain</button><button className="rb btn" data-testid="fx-clear" onClick={() => void clearFx()} disabled={!fxFound.length}>Remove all</button></div>
            <p className="mono mu" data-testid="fx-meter" data-over={fxM.over}>{fxFound.length === 0 ? `No effects on ${fxFrame || 'this frame'} yet` : `${fxFrame}: ${fxFound.length} layer${fxFound.length === 1 ? '' : 's'} · ${fxM.frameMs.toFixed(0)} ms per update · ${Math.round(fxM.load * 100)}% GPU${fxM.over ? ` · OVER: ${fxM.reason}` : ' · within budget'}`}</p>
            {fxS && <div className="projs"><span className="mono mu" data-testid="fx-suggest">{fxS.text}</span><button className="rb btn" data-testid="fx-apply" onClick={() => void applyFx()}>Apply</button></div>}
            <h2>Check <span className="mono mu">{checkNote || 'contrast, clipping, taps'}</span></h2>
            <div className="projs"><button className="rb btn" onClick={() => void checkFrame()} data-testid="check" title="Instant local checks on the selected frame (or the first one)">Check frame</button><button className="rb btn" onClick={() => void checkAll()} data-testid="check-all" title="Check every frame of this project">Check all frames</button><button className="rb btn" onClick={() => void askClaude()} disabled={critiquing || helper.status !== 'connected'} data-testid="critique" title="Local checks first, then Claude judges hierarchy, spacing and copy (uses a little subscription)">{critiquing ? 'Asking…' : 'Ask Claude'}</button></div>
            <ul className="liblist" data-testid="findings">{findings.map((f, i) => (<li key={`${f.el}-${f.kind}-${i}`} className="libitem" data-testid="finding" data-kind={f.kind}><button className="rb btn mono" onClick={() => { setSelection({ frameId: f.frame, el: f.el }); window.__swift?.fitTo([f.frame]); }} data-testid="finding-select" title="Select this element">{f.frame}/{f.el}</button> <span className="mu">{f.message}</span>{f.fix && <button className="rb btn" onClick={() => void fixFinding(f)} data-testid="finding-fix">Fix: {f.fix.prop} {f.fix.value}</button>}</li>))}</ul>
            <h2>History <span className="mono mu">Says on this device</span></h2>
            <ul className="liblist" data-testid="history">{recs.filter((r) => r.prompt).slice(-12).reverse().map((r) => (<li key={r.id} className="mono" data-testid="history-row">“{r.prompt}” <span className="mu">· {r.tier}{r.firstMs != null ? ` · first ${r.firstMs.toFixed(0)} ms` : ''} · {r.ms.toFixed(0)} ms{r.rejected ? ` · ${r.rejected} rejected` : ''}{!r.ok ? ' · failed' : ''}{r.undone ? ' · undone' : ''}</span></li>))}</ul>
            <h2>Pulse <span className="mono mu">this device, last {recs.length}</span></h2>
            <ul className="liblist" data-testid="pulse">{summarize(recs).map((x) => (<li key={`${x.tier}/${x.skill}`} className="mono" data-testid="pulse-row">{x.skill} <span className="mu">· {x.tier} · n {x.n} · p50 {x.p50.toFixed(0)} ms · p95 {x.p95.toFixed(0)} ms{x.failed ? ` · ${x.failed} failed` : ''}{x.undone ? ` · ${x.undone} undone` : ''}</span>{flags(x).map((f) => <span key={f} className="mono" data-testid="pulse-flag"> ⚑ {f}</span>)}</li>))}{recs.length === 0 && <li className="mu">No edits yet</li>}</ul>
            {(() => { const u = summarizeUsage(usage); return <p className="mono mu" data-testid="usage">{u.requests === 0 ? 'No Claude requests yet' : `Claude tokens: ${u.requests} requests · ${u.input.toLocaleString()} in · ${u.output.toLocaleString()} out · avg ${Math.round(u.avgInput).toLocaleString()} in / ${Math.round(u.avgOutput).toLocaleString()} out · Spark ×4 ≈ ${tokensShort((e => e.input + e.output)(estimateSpark(usage, 4)))}`}</p>; })()}
            <div className="projs"><button className="rb btn" onClick={() => void refine()} disabled={refining || helper.status !== 'connected'} data-testid="refine" title="Ask Claude to propose changes for flagged skills; nothing is applied">Review skills{isDue(lastRefine(), Date.now()) && recs.length > 0 ? ' · due' : ''}</button></div>
            <label className="mono mu"><input type="checkbox" checked={autoRefine} onChange={(e) => toggleAutoRefine(e.target.checked)} data-testid="refine-auto" /> Review weekly when flagged (uses a little subscription)</label>
            {refineNote && <p className="mono mu" data-testid="refine-note">{refineNote}</p>}
            <ul className="liblist" data-testid="proposals">{proposals.map((p, i) => (<li key={i} className="mono" data-testid="proposal"><b>{p.skill}</b> <span className="mu">{p.problem}</span><br />{p.change}</li>))}</ul>
            <h2>Project</h2>
            <div className="projs"><button className="rb btn" onClick={() => { setFrameMenuOpen(false); void exportProject(); }} data-testid="export-project">Export project file</button><button className="rb btn" onClick={() => void planRepoExport()} data-testid="repo-export" title="Preview, then commit the frames and project file on a new branch of a repo you pick">Export to repo branch…</button><button className="rb btn" onClick={() => { setFrameMenuOpen(false); void saveToRepo(); }} data-testid="save-repo" title="Write .swift-canvas/project.json into a repo folder you choose">Save into a repo folder…</button><button className="rb btn" onClick={() => fileRef.current?.click()} data-testid="open-project">Open project file…</button><button className="rb btn" onClick={resetDesign} data-testid="reset">Reset design</button></div>
          </div>
        </>)}
        {dropping && <div className="dropcover mono" data-testid="dropcover" onDragOver={(e) => e.preventDefault()} onDragLeave={() => setDropping(false)} onDrop={() => setDropping(false)}>Drop to add to the moodboard</div>}
        {shortcutsOpen && <Shortcuts onClose={() => { setShortcutsOpen(false); kbRef.current?.focus(); }} />}
        {appearanceOpen && <Appearance theme={theme} onChange={(p) => setTheme((t) => sanitize({ ...t, ...p }))} onClose={closeAppearance} />}
        <nav className="gl isl lens" aria-label="Lens">
          {LENSES.map((l) => (<button key={l} className={`rb seg${l === lens ? ' on' : ''}`} aria-pressed={l === lens} onClick={() => setLens(l)}>{l}</button>))}
        </nav>
        <div className="gl isl speed" role="status" aria-live="polite" data-testid="helper-status">
          <span className={`dot ${dot}`} aria-hidden />
          <button className="rb btn zoombtn" aria-label={`Zoom ${zoomPct} percent: click for actual size`} title="Click for actual size (⌘1)" data-testid="zoom" onClick={actualSize}>{zoomPct}%</button>
          <button ref={kbRef} className="rb btn kbbtn" aria-label="Keyboard shortcuts" aria-haspopup="dialog" aria-expanded={shortcutsOpen} data-testid="shortcuts-button" onClick={() => setShortcutsOpen((o) => !o)}>?</button>
          <span className="mono helpertxt" title={helper.status === 'connected' ? `helper · claude ${helper.claude ?? '?'}` : `helper · ${helper.status}`}>{helper.status === 'connected' ? (helper.claudeStatus && helper.claudeStatus.state !== 'ready' ? `helper · claude ${helper.claudeStatus.state.replace('_', ' ')}` : `helper · claude ${(helper.claude ?? '?').split(' (')[0]}`) : `helper · ${helper.status}`}</span>
          {helper.status === 'connected' && helper.claudeStatus && helper.claudeStatus.state !== 'ready' && <button className="rb btn" onClick={() => conn.current?.recheckClaude()} title={helper.claudeStatus.message} data-testid="claude-recheck">Re-check</button>}
        </div>
      </header>
      <Canvas chrome={chrome} onResize={(f, e, dw, dh, ph) => void resizeElement(f, e, dw, dh, ph)} onMove={(f, e, dx, dy, ph) => void moveElement(f, e, dx, dy, ph)} painting={painting} key={epoch} onRename={(id, t) => { const next = renameFrame(frames, id, t); if (next === frames) return; const before = frames.find((f) => f.id === id)?.title ?? ''; const after = next.find((f) => f.id === id)?.title ?? ''; recordOp({ kind: 'rename', frame: id, before, after }); setFrames(next); }} frames={frames} selection={selection} extras={extras} onSelect={pickElement} revision={revision} onReady={() => setRevision((n) => n + 1)} />
      <Layers onToggleHidden={(el, hidden) => void edit(selection?.frameId ?? frames[0]?.id ?? '', el, 'visibility', hidden ? 'hidden' : 'visible')} frameId={selection?.frameId ?? frames[0]?.id ?? ''} selection={selection} extras={extras} onSelect={pickElement} revision={revision} />
      <Inspector selection={selection} revision={revision} onEdit={(prop, value) => { if (selection) void edit(selection.frameId, selection.el, prop, value); }} />
      {chips.length > 0 && !saying && !sayText && !pendingAsk && (
        <div className="gl isl chips" role="group" aria-label="Suggestions" data-testid="chips">
          {chips.map((c) => <button key={c.label} className="rb btn chip" onClick={() => void say(c.text)} data-testid="chip">{c.label}</button>)}
        </div>
      )}
      <form className="gl isl say" aria-label="Say" onSubmit={(e) => { e.preventDefault(); void say(); }}>
        <input ref={sayRef} data-testid="say-input" aria-label="Say what to change" title="⌘K" placeholder={pendingAsk ? `Claude asks: ${pendingAsk.question}` : selection ? `Say what to change about #${selection.el}…` : 'Say what to change…'} value={sayText} onChange={(e) => { setSayText(e.target.value); histPos.current = sayHist.current.length; }} onKeyDown={(e) => { if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return; const h = sayHist.current; if (h.length === 0) return; e.preventDefault(); if (histPos.current >= h.length) draft.current = sayText; const r = step(h, histPos.current, e.key === 'ArrowUp' ? -1 : 1, draft.current); histPos.current = r.pos; setSayText(r.text); }} onFocus={() => conn.current?.prewarm()} disabled={saying} />
        <button type="submit" className="rb btn say-go" data-testid="say-button" disabled={saying || !sayText.trim()}>Say</button>
        <span key={sayStatus} className="mono mu say-status morph" data-testid="say-status" role="status">{sayStatus}</span>
      </form>
      <footer className="gl isl tools" aria-label="Canvas tools">
        <button className="rb btn" onClick={() => window.__swift?.fitAll()}>Fit</button>
        {sparking ? <>{selection && takesRunning.current.has(selection.frameId) && <button className="rb btn" onClick={() => takesRunning.current.get(selection.frameId)?.abort()} data-testid="cancel-take">Cancel this take</button>}<button className="rb btn" onClick={() => sparkAbort.current?.abort()} data-testid="spark-cancel">Cancel Spark</button></> : <button className="rb btn" onClick={() => void spark(4)} data-testid="spark-button" title={`Spark ×4 costs about ${tokensShort((e => e.input + e.output)(estimateSpark(usage, 4)))} tokens (from your recent requests, cached input included)`}>Spark ×4</button>}
        <button className="rb btn" onClick={() => selection && setFrames((f) => keepTake(f, selection.frameId))} disabled={!selIsTake} data-testid="keep-take">Keep take</button>
        <button className="rb btn" onClick={() => void discard()} disabled={takeCount === 0} data-testid="discard-takes">Discard takes{takeCount ? ` (${takeCount})` : ''}</button>
        <button ref={fmRef} className="rb btn" aria-haspopup="dialog" aria-expanded={frameMenuOpen} data-testid="frame-menu" onClick={() => setFrameMenuOpen((o) => !o)}>Frame ▾</button>
        <button className="rb btn" onClick={() => void undo()} disabled={edits === 0} data-testid="undo">Undo{edits ? ` (${edits})` : ''}</button>
        <button className="rb btn" onClick={() => void redo()} disabled={redos === 0} data-testid="redo">Redo{redos ? ` (${redos})` : ''}</button>
        <span className="mono mu" data-testid="tier0">{tier0 || 'Tier 0 · ready'}</span>
        {saveStatus && <span className="mono mu" data-testid="save-status" role="status">{saveStatus}</span>}
        {sparkStatus && <span className="mono mu" data-testid="spark-status" role="status">{sparkStatus}</span>}
      </footer>
    </div>
  );
}
