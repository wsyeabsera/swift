import { useEffect, useRef, type ReactElement } from 'react';
import { LENSES, LENS_INFO, nextLens, prevLens, tourAction, type Lens } from './lenses';
/** The per-lens header strip (task #1843): one line on what the lens does, three key actions and the Claude Code prompt that does the same. With `tour` on it also steps the lenses (→/←, Esc leaves). Never modal: it sits beside the canvas, takes no focus and does not block it. */
export function LensStrip({ lens, tour, onStep, onExit, onHide }: { lens: Lens; tour: boolean; onStep: (l: Lens) => void; onExit: () => void; onHide?: () => void }): ReactElement {
  const info = LENS_INFO[lens]; const n = LENSES.indexOf(lens) + 1; const next = nextLens(lens); const prev = prevLens(lens);
  const cb = useRef({ lens, onStep, onExit }); cb.current = { lens, onStep, onExit };
  useEffect(() => {
    if (!tour) return;
    const k = (e: KeyboardEvent): void => {
      const a = tourAction(e); if (!a) return; const { lens: l, onStep: step, onExit: exit } = cb.current;
      if (a === 'exit') { e.preventDefault(); exit(); return; }
      const to = a === 'next' ? nextLens(l) : prevLens(l); if (to) { e.preventDefault(); step(to); } else if (a === 'next') { e.preventDefault(); exit(); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [tour]);
  return (
    <section className="gl isl lensstrip" aria-label={`${lens} lens`} data-testid="lens-strip" data-lens={lens} data-built={info.built}>
      <div className="lensstrip-top"><b data-testid="lens-strip-name">{lens}</b><span className="mono mu">{tour ? `Tour ${n} of ${LENSES.length}` : 'this lens'}</span>
        {tour && <span className="lensstrip-nav"><button className="rb btn" onClick={() => prev && onStep(prev)} disabled={!prev} aria-label="Previous lens" data-testid="tour-prev">← Back</button><button className="rb btn" onClick={() => (next ? onStep(next) : onExit())} data-testid="tour-next">{next ? 'Next →' : 'Done'}</button><button className="rb btn" onClick={onExit} aria-label="Leave the tour" data-testid="tour-exit">Esc</button></span>}
        {!tour && onHide && <button className="rb btn" style={{ marginLeft: 'auto' }} onClick={onHide} aria-label="Hide lens hints" data-testid="lens-strip-hide">Hide</button>}
      </div>
      <p className="lensstrip-line" data-testid="lens-strip-line" {...(tour ? { role: 'status', 'aria-live': 'polite' as const } : {})}>{info.line}</p>
      <ul className="lensstrip-acts mono" data-testid="lens-strip-actions">{info.actions.map((a) => <li key={a}>{a}</li>)}</ul>
      <p className="lensstrip-prompt mono mu" data-testid="lens-strip-prompt"><span>Claude Code</span> {info.prompt}</p>
    </section>
  );
}
