import { useEffect, useState } from 'react';
import type { TreeNode } from './canvas/bridge';
import type { Sel } from './canvas/Canvas';
export const INSPECT_PROPS = ['left', 'top', 'width', 'height', 'font-size', 'color', 'background-color', 'border-radius', 'opacity'] as const;
const ICON = { frame: 'M4 5h16v14H4z', group: 'M3 7h6l2 2h10v10H3z', text: 'M5 6h14M12 6v13M9 19h6', image: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4' } as const;
const Ico = ({ d }: { d: string }) => (<svg className="lico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>);
const EyeIco = ({ off }: { off: boolean }) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{off && <path d="M4 4l16 16" />}</svg>);
const LockIco = ({ on }: { on: boolean }) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="11" width="14" height="9" rx="2" /><path d={on ? 'M8 11V8a4 4 0 018 0v3' : 'M8 11V8a4 4 0 017.5-2'} /></svg>);
/** Layers: the element tree (elements with ids) of the selected frame, as designed: a type icon, the name, a `say` tag on the element Say will change, an eye (hide, undoable) and a lock (the element cannot be picked on the canvas). */
export function Layers({ frameId, selection, extras = [], onSelect, onToggleHidden, locked = [], onToggleLock, revision }: { frameId: string; selection: Sel | null; extras?: string[]; onSelect: (s: Sel, additive?: boolean) => void; onToggleHidden?: (el: string, hidden: boolean) => void; locked?: string[]; onToggleLock?: (el: string) => void; revision: number }) {
  const [tree, setTree] = useState<TreeNode[]>([]); const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { // the frame may not have loaded yet (a slow machine): an empty tree is retried for a few seconds instead of staying empty until the next edit
    let alive = true; let timer: ReturnType<typeof setTimeout> | undefined; let tries = 0;
    const load = () => { void window.__swift?.tree(frameId).then((t) => { if (!alive) return; setTree(t); if (t.length === 0 && tries++ < 40) timer = setTimeout(load, 250); }); };
    load(); return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [frameId, revision]);
  const kind = (n: TreeNode, i: number): keyof typeof ICON => (n.tag === 'img' ? 'image' : i === 0 && n.depth === 0 ? 'frame' : tree[i + 1] && tree[i + 1]!.depth > n.depth ? 'group' : 'text');
  return (
    <aside className={`gl isl-panel layers${collapsed ? ' collapsed' : ''}`} aria-label="Layers" data-testid="layers">
      <h2>Layers <span className="mono mu">{frameId}</span><button className="rb collapse" aria-label={collapsed ? 'Expand layers' : 'Collapse layers'} aria-expanded={!collapsed} data-testid="layers-collapse" onClick={() => setCollapsed((c) => !c)}>{collapsed ? '›' : '‹'}</button></h2>
      {!collapsed && <ul>{tree.map((n, i) => { const sel = selection?.frameId === frameId && (selection.el === n.id || extras.includes(n.id)); const isLocked = locked.includes(`${frameId}/${n.id}`); return (
        <li key={`${i}-${n.id}`} className={`lrow${isLocked ? ' locked' : ''}`}><button className={`rb row${sel ? ' on' : ''}`} style={{ paddingLeft: 8 + n.depth * 14 }} onClick={(e) => onSelect({ frameId, el: n.id }, e.shiftKey)}>
          <Ico d={ICON[kind(n, i)]} /><span className="mono">{n.id}</span><span className="mu"> {n.text}</span>{sel && selection?.el === n.id && <span className="say-tag" data-testid="say-tag">say</span>}</button>
          {onToggleHidden && <button className="rb eye" data-testid={`eye-${n.id}`} aria-label={`${n.hidden ? 'Show' : 'Hide'} ${n.id}`} aria-pressed={!!n.hidden} title={n.hidden ? 'Hidden: click to show' : 'Click to hide'} onClick={() => onToggleHidden(n.id, !n.hidden)}><EyeIco off={!!n.hidden} /></button>}
          {onToggleLock && <button className="rb lock" data-testid={`lock-${n.id}`} aria-label={`${isLocked ? 'Unlock' : 'Lock'} ${n.id}`} aria-pressed={isLocked} title={isLocked ? 'Locked: it cannot be picked on the canvas. Click to unlock' : 'Click to lock (it cannot be picked on the canvas)'} onClick={() => onToggleLock(n.id)}><LockIco on={isLocked} /></button>}</li>); })}</ul>}
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
      <div key={selection ? `${selection.frameId}/${selection.el}` : 'none'} className="morph"> {/* a new selection re-plays the glass morph, so the island changes state instead of snapping */}
      <h2>Inspector <span className="mono mu" data-testid="inspector-id">{selection?.el ?? 'nothing selected'}</span></h2>
      {selection && INSPECT_PROPS.map((p) => (
        <label key={p} className="fld"><span className="mu">{p}</span>
          <input aria-label={p} value={draft[p] ?? ''} onChange={(e) => setDraft({ ...draft, [p]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && draft[p] !== undefined && draft[p] !== values[p]) onEdit(p, draft[p]); }} /></label>))}
      </div>
    </aside>
  );
}
