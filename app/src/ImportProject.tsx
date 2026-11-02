import { useState } from 'react';
import type { ScanResult } from './helper';
import { toBrandTokens } from './brand';
import { baseName, type Project } from './projects';
const isColor = (v: string) => /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\()/i.test(v.trim());
/** Import popover: give a project folder, see the brand kit found in it (tokens, colours, fonts). Only folders the helper was allowed to read can be scanned. */
export function ImportProject({ scan, onUse, onCreate, onSwitch, projects, kits, active, using, onClose }: { scan: (path: string) => Promise<ScanResult>; onUse: (tokens: Record<string, string>) => void; onCreate: (name: string, tokens: Record<string, string>) => void; onSwitch: (id: string) => void; projects: Project[]; kits: Record<string, string[]>; active: string; using: number; onClose: () => void }) {
  const [path, setPath] = useState(''); const [busy, setBusy] = useState(false); const [res, setRes] = useState<ScanResult | null>(null);
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
          <button type="submit" className="rb btn" disabled={busy || !path.trim()} data-testid="import-scan">{busy ? 'Reading…' : 'Read brand'}</button>
        </form>
        <p className="mu mono" data-testid="import-using">Say uses {using} brand tokens</p>
        <div role="status" data-testid="import-result" className="importres">
          {res && !res.ok && <p className="mu">{res.error}</p>}
          {res?.ok && (<>
            <p className="mu mono">{res.scan.files} files · {res.scan.tokens.length} tokens</p>
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
