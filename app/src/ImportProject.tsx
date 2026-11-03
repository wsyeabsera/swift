import { useRef, useState } from 'react';
import type { PickResult, ScanResult } from './helper';
import { toBrandTokens } from './brand';
import { PRESETS } from './canvas/frames';
import { baseName, type Project } from './projects';
const isColor = (v: string) => /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\()/i.test(v.trim());
/** Import popover: give a project folder, see the brand kit found in it (tokens, colours, fonts). Only folders the helper was allowed to read can be scanned. */
export type CaptureOutcome = { message: string; tokens: { name: string; value: string }[]; page?: { html: string; url: string; size: { w: number; h: number } } };
export function ImportProject({ scan, pick, capture, onCreatePage, screenshot, onUse, onCreate, onSwitch, projects, kits, active, using, onClose }: { scan: (path: string) => Promise<ScanResult>; pick: () => Promise<PickResult>; capture: (url: string, size: { w: number; h: number }, add: boolean, fullPage: boolean) => Promise<CaptureOutcome>; onCreatePage: (page: NonNullable<CaptureOutcome['page']>, tokens: Record<string, string>) => void; screenshot: (file: File, asProject: boolean) => Promise<string>; onUse: (tokens: Record<string, string>) => void; onCreate: (name: string, tokens: Record<string, string>) => void; onSwitch: (id: string) => void; projects: Project[]; kits: Record<string, string[]>; active: string; using: number; onClose: () => void }) {
  const [path, setPath] = useState(''); const [busy, setBusy] = useState(false); const [res, setRes] = useState<ScanResult | null>(null);
  const choose = async () => { if (busy) return; setBusy(true); const r = await pick(); if (r.ok) { setPath(r.path); setRes(await scan(r.path)); } else if (r.error !== 'cancelled') setRes({ ok: false, error: r.error }); setBusy(false); };
  const [url, setUrl] = useState('http://localhost:'); const [capMsg, setCapMsg] = useState(''); const [capBusy, setCapBusy] = useState(false); const [fullPage, setFullPage] = useState(false); const [dev, setDev] = useState<keyof typeof PRESETS>('desktop'); const [capTokens, setCapTokens] = useState<Record<string, string>>({});
  const runCapture = async (asProject = false) => { if (capBusy || !url.trim()) return; setCapBusy(true); setCapMsg('Rendering the page…'); setCapTokens({}); const r = await capture(url.trim(), { w: PRESETS[dev].w, h: PRESETS[dev].h }, !asProject, fullPage); if (asProject && r.page) { onCreatePage(r.page, toBrandTokens(r.tokens)); return; } setCapMsg(r.message); setCapTokens(toBrandTokens(r.tokens)); setCapBusy(false); };
  const shotInput = useRef<HTMLInputElement>(null); const shotMode = useRef(false); const [shotMsg, setShotMsg] = useState(''); const [shotBusy, setShotBusy] = useState(false);
  const runShot = async (f: File) => { if (shotBusy) return; setShotBusy(true); setShotMsg('Claude is rebuilding the screenshot…'); setShotMsg(await screenshot(f, shotMode.current)); setShotBusy(false); };
  const run = async () => { if (!path.trim() || busy) return; setBusy(true); setRes(null); setRes(await scan(path.trim())); setBusy(false); };
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="gl pop import" role="dialog" aria-label="Import a project" data-testid="import" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
        <h2>Projects</h2>
        <ul className="projs" data-testid="projects">{projects.map((p) => (<li key={p.id}><button type="button" className={`rb btn${p.id === active ? ' on' : ''}`} aria-current={p.id === active} disabled={p.id === active} data-testid={`project-${p.id}`} onClick={() => onSwitch(p.id)}>{(kits[p.id] ?? []).map((c) => <span key={c} className="sw sm" style={{ background: c }} />)}{p.name}</button></li>))}</ul>
        <h2>New project from a repo folder</h2>
        <form className="importform" onSubmit={(e) => { e.preventDefault(); void run(); }}>
          <input aria-label="Project folder" data-testid="import-path" placeholder="/Users/you/Hobby/your-project" value={path} onChange={(e) => setPath(e.target.value)} autoFocus />
          <button type="button" className="rb btn" disabled={busy} data-testid="import-choose" onClick={() => void choose()}>Choose…</button>
          <button type="submit" className="rb btn" disabled={busy || !path.trim()} data-testid="import-scan">{busy ? 'Reading…' : 'Read brand'}</button>
        </form>
        <h2>Capture a running page</h2>
        <form className="importform" onSubmit={(e) => { e.preventDefault(); void runCapture(); }}>
          <input aria-label="Page address" data-testid="capture-url" placeholder="http://localhost:5173" value={url} onChange={(e) => setUrl(e.target.value)} />
          <select aria-label="Page size" data-testid="capture-size" value={dev} onChange={(e) => setDev(e.target.value as keyof typeof PRESETS)}>{(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => <option key={k} value={k}>{PRESETS[k].label}</option>)}</select>
          <label className="mono mu"><input type="checkbox" data-testid="capture-full" checked={fullPage} onChange={(e) => setFullPage(e.target.checked)} /> full page</label>
          <button type="submit" className="rb btn" disabled={capBusy || !url.trim()} data-testid="capture-go">{capBusy ? 'Capturing…' : 'Capture'}</button>
          <button type="button" className="rb btn" disabled={capBusy || !url.trim()} data-testid="capture-project" onClick={() => void runCapture(true)} title="Open the page as its own project, with its brand">As project</button>
        </form>
        <p className="mu" role="status" data-testid="capture-status">{capMsg || 'A page on this computer (localhost) becomes an editable frame.'}</p>
        {Object.keys(capTokens).length > 0 && <button type="button" className="rb btn" data-testid="capture-use" onClick={() => onUse(capTokens)}>Use this page’s brand ({Object.keys(capTokens).length} tokens)</button>}
        <h2>From a screenshot</h2>
        <div className="importform">
          <input ref={shotInput} type="file" accept="image/png,image/jpeg" hidden data-testid="shot-input" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void runShot(f); }} />
          <button type="button" className="rb btn" disabled={shotBusy} data-testid="shot-choose" onClick={() => { shotMode.current = false; shotInput.current?.click(); }}>{shotBusy ? 'Rebuilding…' : 'Choose image…'}</button>
          <button type="button" className="rb btn" disabled={shotBusy} data-testid="shot-project" onClick={() => { shotMode.current = true; shotInput.current?.click(); }} title="Open the rebuilt screenshot as its own project">As project</button>
        </div>
        <p className="mu" role="status" data-testid="shot-status">{shotMsg || 'A PNG or JPEG (up to 5 MB, at least 200×200 px) is rebuilt by Claude as an editable frame.'}</p>
        <p className="mu mono" data-testid="import-using">Say uses {using} brand tokens</p>
        <div role="status" data-testid="import-result" className="importres">
          {res && !res.ok && <p className="mu">{res.error}</p>}
          {res?.ok && (<>
            <p className="mu mono">{res.scan.files} files · {res.scan.tokens.length} tokens</p>
            {res.scan.tokens.length === 0 && res.scan.colors.length === 0 && <p className="mu" data-testid="import-empty">No brand tokens or colours found here. You can still create the project and set the look with Say.</p>}
            <div className="swatches">{res.scan.colors.slice(0, 8).map((c) => <span key={c.value} className="sw" title={`${c.value} · ${c.count}×`} style={{ background: c.value }} />)}</div>
            <ul className="toks">{res.scan.tokens.slice(0, 14).map((t) => (<li key={t.name}>{isColor(t.value) && <span className="sw sm" style={{ background: t.value }} />}<span className="mono">{t.name}</span><span className="mu mono"> {t.value}</span></li>))}</ul>
            <button type="button" className="rb btn" data-testid="import-use" disabled={Object.keys(toBrandTokens(res.scan.tokens)).length === 0} onClick={() => onUse(toBrandTokens(res.scan.tokens))}>Use this brand ({Object.keys(toBrandTokens(res.scan.tokens)).length} tokens)</button>
            {baseName(path.trim()) && <button type="button" className="rb btn" data-testid="import-create" onClick={() => onCreate(baseName(path.trim()), toBrandTokens(res.scan.tokens))}>Create project “{baseName(path.trim())}”</button>}
            {res.scan.fonts.length > 0 && <p className="mu">Fonts: {res.scan.fonts.map((f) => f.value).join(', ')}</p>}
          </>)}
        </div>
      </div>
    </>
  );
}
