import type { ReactElement } from 'react';
import type { Finding } from './canvas/audit';
export type FrameFinding = Finding & { frame: string };
const KIND: Record<Finding['kind'], string> = { contrast: 'Contrast', safe: 'Safe area', critique: 'Claude', clipped: 'Clipped', offscreen: 'Off screen', tap: 'Tap target', legibility: 'Legibility' };
/** The Critique lens' findings panel (the board's right-hand panel): a numbered list with the kind, the element, the message and the one-click fix; the same testids the Frame panel list used. */
export function CritiquePanel({ findings, note, busy, onRun, onSelect, onFix, onLoadSample }: { onLoadSample?: () => void; findings: FrameFinding[]; note: string; busy: boolean; onRun: () => void; onSelect: (f: FrameFinding) => void; onFix: (f: FrameFinding) => void }): ReactElement {
  const fixable = findings.filter((f) => f.fix).length;
  return (
    <aside className="gl isl-panel critpanel" aria-label="Critique" data-testid="critique-panel">
      <h2>Critique <span className="mono mu" data-testid="critique-count">{findings.length} open{fixable ? ` · ${fixable} fixable` : ''}</span></h2>
      <p className="mono mu critnote">{note || 'Contrast, clipping and tap targets, checked on the frame itself.'}</p>
      <ol className="critlist" data-testid="findings">
        {findings.map((f, i) => (
          <li key={`${f.el}-${f.kind}-${i}`} className="crititem" data-testid="finding" data-kind={f.kind}>
            <span className="critdot" aria-hidden="true">{i + 1}</span>
            <div className="critbody">
              <div className="critkind mono">{KIND[f.kind]} <button className="rb mono critsel" onClick={() => onSelect(f)} data-testid="finding-select" title="Select this element">{f.frame}/{f.el}</button></div>
              <p className="critmsg">{f.message}</p>
              {f.fix && <button className="rb btn" onClick={() => onFix(f)} data-testid="finding-fix">Fix: {f.fix.prop} {f.fix.value}</button>}
            </div>
          </li>
        ))}
        {findings.length === 0 && <li className="mono mu critempty">Nothing open. Run a check to look again.{onLoadSample && <> <button className="rb btn emptyload" onClick={onLoadSample} data-testid="load-sample">Load sample</button></>}</li>}
      </ol>
      <div className="projs"><button className="rb btn" onClick={onRun} disabled={busy} data-testid="critique-run">Check frame</button></div>
    </aside>
  );
}
