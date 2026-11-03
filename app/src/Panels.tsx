import { useEffect, useState } from 'react';
import type { TreeNode } from './canvas/bridge';
import type { Sel } from './canvas/Canvas';
export const INSPECT_PROPS = ['left', 'top', 'width', 'height', 'font-size', 'color', 'background-color', 'border-radius', 'opacity'] as const;
/** Layers: the element tree (elements with ids) of the selected frame; clicking selects on the canvas. */
export function Layers({ frameId, selection, extras = [], onSelect, onToggleHidden, revision }: { frameId: string; selection: Sel | null; extras?: string[]; onSelect: (s: Sel, additive?: boolean) => void; onToggleHidden?: (el: string, hidden: boolean) => void; revision: number }) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  useEffect(() => { let alive = true; void window.__swift?.tree(frameId).then((t) => { if (alive) setTree(t); }); return () => { alive = false; }; }, [frameId, revision]);
  return (
    <aside className="gl isl-panel layers" aria-label="Layers" data-testid="layers">
      <h2>Layers <span className="mono mu">{frameId}</span></h2>
      <ul>{tree.map((n) => (
        <li key={n.id} className="lrow"><button className={`rb row${selection?.frameId === frameId && (selection.el === n.id || extras.includes(n.id)) ? ' on' : ''}`} style={{ paddingLeft: 8 + n.depth * 14 }} onClick={(e) => onSelect({ frameId, el: n.id }, e.shiftKey)}>
          <span className="mono">{n.id}</span><span className="mu"> {n.text}</span></button>{onToggleHidden && <button className="rb eye" data-testid={`eye-${n.id}`} aria-label={`${n.hidden ? 'Show' : 'Hide'} ${n.id}`} aria-pressed={!!n.hidden} title={n.hidden ? 'Hidden: click to show' : 'Click to hide'} onClick={() => onToggleHidden(n.id, !n.hidden)}>{n.hidden ? '◌' : '●'}</button>}</li>))}</ul>
    </aside>
  );
}
/** Inspector: computed values of the selection; Enter applies an edit through the same path as every other edit (and is undoable). */
export function Inspector({ selection, revision, onEdit }: { selection: Sel | null; revision: number; onEdit: (prop: string, value: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({}); const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true; if (!selection) { setValues({}); setDraft({}); return; }
    void window.__swift?.props(selection.frameId, selection.el, [...INSPECT_PROPS]).then((v) => { if (alive && v) { setValues(v); setDraft(v); } });
    return () => { alive = false; };
  }, [selection, revision]);
  return (
    <aside className="gl isl-panel inspector" aria-label="Inspector" data-testid="inspector">
      <h2>Inspector <span className="mono mu" data-testid="inspector-id">{selection?.el ?? 'nothing selected'}</span></h2>
      {selection && INSPECT_PROPS.map((p) => (
        <label key={p} className="fld"><span className="mu">{p}</span>
          <input aria-label={p} value={draft[p] ?? ''} onChange={(e) => setDraft({ ...draft, [p]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && draft[p] !== undefined && draft[p] !== values[p]) onEdit(p, draft[p]); }} /></label>))}
    </aside>
  );
}
