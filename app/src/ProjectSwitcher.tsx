import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { rankProjects, slug, type Project } from './projects';
/** The quick project switcher (⌘P): type to filter, ↑/↓ to move, Enter to open, and when nothing matches exactly Enter creates the project. Recent projects come first. */
export function ProjectSwitcher({ projects, active, recent, onPick, onCreate, onClose }: { projects: Project[]; active: string; recent: string[]; onPick: (id: string) => void; onCreate: (name: string) => void; onClose: () => void }): ReactElement {
  const [q, setQ] = useState(''); const [i, setI] = useState(0); const input = useRef<HTMLInputElement>(null); useEffect(() => input.current?.focus(), []);
  const hits = useMemo(() => rankProjects(projects, q, recent), [projects, q, recent]); const canCreate = q.trim().length > 0 && slug(q) !== '' && !projects.some((p) => p.id === slug(q));
  const rows: { key: string; label: string; hint: string; act: () => void }[] = [...hits.map((p) => ({ key: p.id, label: p.name, hint: p.id === active ? 'open now' : recent.includes(p.id) ? 'recent' : '', act: () => onPick(p.id) })), ...(canCreate ? [{ key: '__new', label: `Create “${q.trim()}”`, hint: 'new project', act: () => onCreate(q.trim()) }] : [])];
  const at = Math.min(i, Math.max(0, rows.length - 1));
  const key = (e: React.KeyboardEvent): void => { if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(rows.length - 1, x + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); } else if (e.key === 'Enter') { e.preventDefault(); rows[at]?.act(); } else if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
  return (
    <div className="switcher-wrap" onClick={onClose}>
      <div className="gl switcher" role="dialog" aria-label="Switch project" data-testid="switcher" onClick={(e) => e.stopPropagation()} onKeyDown={key}>
        <input ref={input} className="switcher-in" value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} placeholder="Switch project… type to filter, Enter to open" aria-label="Project" aria-controls="switcher-list" data-testid="switcher-input" />
        <ul id="switcher-list" className="switcher-list" role="listbox" data-testid="switcher-list">
          {rows.map((r, n) => (<li key={r.key} role="option" aria-selected={n === at}><button type="button" className={`rb switcher-row${n === at ? ' on' : ''}`} onMouseEnter={() => setI(n)} onClick={r.act} data-testid="switcher-row" data-id={r.key}><span>{r.label}</span><span className="mono mu">{r.hint}</span></button></li>))}
          {rows.length === 0 && <li className="mono mu switcher-empty">No projects yet.</li>}
        </ul>
      </div>
    </div>
  );
}
