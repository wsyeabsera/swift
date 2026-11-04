import { useEffect, type ReactElement } from 'react';
import type { ShipRec } from './ship';
/** The Ship result board (the board's central panel): what landed, how long it took, each output with its outcome, the artifact link when there is one, and Ship again / Back to canvas. */
export function ShipBoard({ run, artifactUrl, onAgain, onClose }: { run: { rows: ShipRec[]; ok: number; failed: number; skipped: number; ms: number }; artifactUrl?: string; onAgain: () => void; onClose: () => void }): ReactElement {
  useEffect(() => { const k = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const copy = (): void => { if (artifactUrl) void navigator.clipboard?.writeText(artifactUrl).catch(() => undefined); };
  return (
    <div className="shipboard-wrap" onClick={onClose}>
      <section className="gl shipboard" role="dialog" aria-label="Ship results" data-testid="ship-board" onClick={(e) => e.stopPropagation()}>
        <div className="mono shipchip" data-testid="ship-summary">{`${run.ok} output${run.ok === 1 ? '' : 's'} landed${run.failed ? ` · ${run.failed} failed` : ''}${run.skipped ? ` · ${run.skipped} skipped` : ''}`} <span className="mu">· {(run.ms / 1000).toFixed(2)} s wall</span></div>
        <h2 className="shipbig">{run.failed ? 'Some outputs need a look' : run.rows.length ? 'Shipped.' : 'Nothing was selected.'}</h2>
        {artifactUrl && <div className="shiplink"><span className="mono">{artifactUrl}</span><button className="rb btn" onClick={copy} data-testid="ship-copy">Copy</button></div>}
        <ul className="shiprows" data-testid="ship-rows">{run.rows.map((r) => (<li key={`${r.at}-${r.name}`} className="shiprow" data-ok={r.ok}><span aria-hidden="true">{r.ok ? '✓' : '✗'}</span><span className="mono shipkind">{r.kind}</span><span className="shipname">{r.name}</span><span className="mono mu shipdetail">{r.detail}</span></li>))}</ul>
        <div className="projs"><button className="rb btn" onClick={onAgain} data-testid="ship-again">Ship again</button><button className="rb btn" onClick={onClose} data-testid="ship-close">Back to canvas</button></div>
      </section>
    </div>
  );
}
