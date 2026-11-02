import { ACCENTS, BACKDROPS, BACKDROP_KEYS, GLASSES, backdropThumb, type AccentKey, type GlassKey, type Mode, type ThemeChoice } from './theme';
/** Appearance popover (KIT rule H7: scrim sibling, Escape closes from anywhere, focus returns to the control that opened it: handled by the owner). */
export function Appearance({ theme, onChange, onClose }: { theme: ThemeChoice; onChange: (p: Partial<ThemeChoice>) => void; onClose: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" data-testid="appearance-scrim" />
      <div className="gl pop appearance" role="dialog" aria-label="Appearance" data-testid="appearance" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
        <h2>Backdrop</h2>
        <div className="bds">{BACKDROP_KEYS.map((k) => (<button key={k} className={`rb bd${theme.bd === k ? ' on' : ''}`} aria-pressed={theme.bd === k} aria-label={BACKDROPS[k].label} title={`${BACKDROPS[k].label} · ${BACKDROPS[k].credit}`} style={{ backgroundImage: backdropThumb(k) }} onClick={() => onChange({ bd: k })} />))}</div>
        <h2>Mode</h2>
        <div className="segs">{(['dark', 'light', 'auto'] as Mode[]).map((m) => (<button key={m} className={`rb seg${theme.mode === m ? ' on' : ''}`} aria-pressed={theme.mode === m} onClick={() => onChange({ mode: m })}>{m[0]!.toUpperCase() + m.slice(1)}</button>))}</div>
        <h2>Accent</h2>
        <div className="accs">{(Object.keys(ACCENTS) as AccentKey[]).map((k) => (<button key={k} className={`rb acc${theme.accent === k ? ' on' : ''}`} aria-pressed={theme.accent === k} aria-label={k} style={{ background: ACCENTS[k].hex }} onClick={() => onChange({ accent: k })} />))}</div>
        <h2>Glass</h2>
        <div className="segs">{(Object.keys(GLASSES) as GlassKey[]).map((g) => (<button key={g} className={`rb seg${theme.glass === g ? ' on' : ''}`} aria-pressed={theme.glass === g} onClick={() => onChange({ glass: g })}>{GLASSES[g].label}</button>))}</div>
      </div>
    </>
  );
}
