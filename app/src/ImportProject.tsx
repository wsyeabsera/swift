import { useState } from 'react';
import type { ScanResult } from './helper';
const isColor = (v: string) => /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\()/i.test(v.trim());
/** Import popover: give a project folder, see the brand kit found in it (tokens, colours, fonts). Only folders the helper was allowed to read can be scanned. */
export function ImportProject({ scan, onClose }: { scan: (path: string) => Promise<ScanResult>; onClose: () => void }) {
  const [path, setPath] = useState(''); const [busy, setBusy] = useState(false); const [res, setRes] = useState<ScanResult | null>(null);
  const run = async () => { if (!path.trim() || busy) return; setBusy(true); setRes(null); setRes(await scan(path.trim())); setBusy(false); };
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="gl pop import" role="dialog" aria-label="Import a project" data-testid="import" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
        <h2>New project from a repo folder</h2>
        <form className="importform" onSubmit={(e) => { e.preventDefault(); void run(); }}>
          <input aria-label="Project folder" data-testid="import-path" placeholder="/Users/you/Hobby/your-project" value={path} onChange={(e) => setPath(e.target.value)} autoFocus />
          <button type="submit" className="rb btn" disabled={busy || !path.trim()} data-testid="import-scan">{busy ? 'Reading…' : 'Read brand'}</button>
        </form>
        <div role="status" data-testid="import-result" className="importres">
          {res && !res.ok && <p className="mu">{res.error}</p>}
          {res?.ok && (<>
            <p className="mu mono">{res.scan.files} files · {res.scan.tokens.length} tokens</p>
            <div className="swatches">{res.scan.colors.slice(0, 8).map((c) => <span key={c.value} className="sw" title={`${c.value} · ${c.count}×`} style={{ background: c.value }} />)}</div>
            <ul className="toks">{res.scan.tokens.slice(0, 14).map((t) => (<li key={t.name}>{isColor(t.value) && <span className="sw sm" style={{ background: t.value }} />}<span className="mono">{t.name}</span><span className="mu mono"> {t.value}</span></li>))}</ul>
            {res.scan.fonts.length > 0 && <p className="mu">Fonts: {res.scan.fonts.map((f) => f.value).join(', ')}</p>}
          </>)}
        </div>
      </div>
    </>
  );
}
