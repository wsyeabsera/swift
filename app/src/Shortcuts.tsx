export const SHORTCUTS: [string, string][] = [
  ['⌘K', 'Focus Say'], ['↑ / ↓ in Say', 'Earlier requests'], ['⌘Z / ⌘⇧Z', 'Undo / redo'], ['Delete', 'Remove the selected element'], ['Arrows (Shift = 10 px)', 'Nudge a positioned element'],
  ['Enter / Shift+Enter', 'Select first screen, then child / parent'], ['B', 'Branch from the selected take'], ['V / Shift+V', 'Next / previous saved variant of the selected element'], ['Esc', 'Deselect, or close a popover'], ['⌘D', 'Duplicate the selected frame'], ['⌘0', 'Fit everything'], ['⌘1', 'Actual size'], ['Shift+2', 'Zoom to the selected frame'], ['Double-click a frame name', 'Rename it'], ['?', 'This list'],
];
/** Keyboard shortcuts popover (rule H7: scrim sibling, Esc closes, focus returns: handled by the owner). */
export function Shortcuts({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="gl pop shortcuts" role="dialog" aria-label="Keyboard shortcuts" data-testid="shortcuts" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
        <h2>Keyboard shortcuts</h2>
        <dl className="kbs">{SHORTCUTS.map(([k, d]) => (<div key={k}><dt className="mono">{k}</dt><dd>{d}</dd></div>))}</dl>
      </div>
    </>
  );
}
