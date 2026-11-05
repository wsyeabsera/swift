import { useMemo, type ReactElement } from 'react';
import type { Timeline } from './motion';
import { layoutTimeline } from './timelineLayout';
/** The Motion lens' timeline strip (the board's docked panel): transport, a ruler, one row per animated layer with its keyframe bar and diamonds, and the playhead. Clicking the ruler or a row scrubs; editing stays in the Frame panel. */
export function MotionStrip({ motion, t, playing, onScrub, onPlay, onRender, onLoadSample }: { onLoadSample?: () => void; motion: Timeline; t: number; playing: boolean; onScrub: (ms: number) => void; onPlay: () => void; onRender: () => void }): ReactElement {
  const l = useMemo(() => layoutTimeline(motion, t), [motion, t]);
  const scrubAt = (e: React.MouseEvent<HTMLElement>): void => { const r = e.currentTarget.getBoundingClientRect(); onScrub(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * l.end / 10) * 10); };
  return (
    <section className="gl isl mstrip" aria-label="Motion timeline" data-testid="motion-strip">
      <div className="mstrip-top">
        <button className="rb ib" aria-label={playing ? 'Pause' : 'Play'} onClick={onPlay} data-testid="strip-play">{playing ? '❚❚' : '▶'}</button>
        <span className="mono" data-testid="strip-time">{Math.round(t)} ms</span><span className="mono mu">of {l.end} ms</span>
        <button className="rb btn" style={{ marginLeft: 'auto' }} onClick={onRender} disabled={motion.tracks.length === 0} data-testid="strip-render" title="Render the timeline to an MP4 (every 1/30 s)">Render MP4 · {Math.round((l.end / 1000) * 30)} f</button>
      </div>
      <div className="mstrip-grid">
        <div className="mstrip-names" aria-hidden="true"><div className="mstrip-h" />{l.rows.map((r) => (<div key={r.id} className="mstrip-name"><b>{r.label}</b><span className="mono mu">{r.sub}</span></div>))}</div>
        <div className="mstrip-lane" data-testid="strip-lane">
          <div className="mstrip-ruler" onClick={scrubAt} data-testid="strip-ruler">{l.ruler.map((k) => (<span key={k.left} className="mono mu" style={{ left: `${k.left}%` }}>{k.label}</span>))}</div>
          {l.rows.map((r) => (<div key={r.id} className="mstrip-row" onClick={scrubAt} data-testid="strip-row"><span className="mstrip-bar" style={{ left: `${r.bar.left}%`, width: `${r.bar.width}%` }} />{r.keys.map((k) => (<i key={k.t} className="mstrip-key" style={{ left: `${k.left}%` }} title={`${k.t} ms · ${k.ease}`} />))}</div>))}
          {l.rows.length === 0 && <p className="mono mu mstrip-empty">No animated layers yet: add a keyframe in the Frame panel.{onLoadSample && <> <button className="rb btn emptyload" onClick={onLoadSample} data-testid="load-sample">Load sample</button></>}</p>}
          <span className="mstrip-head" style={{ left: `${l.playhead}%` }} data-testid="strip-head" />
        </div>
      </div>
    </section>
  );
}
