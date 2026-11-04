// Local critique pre-pass: the objective checks (contrast, clipped text, tap targets, 10-foot legibility) judged from the facts the frame reports.
// Instant and free; Claude is only asked about what needs judgment. Each finding names its element and, where there is one safe change, a fix (an ordinary edit).
import type { AuditFacts, AuditNode, Rgb } from './bridge';
export type Finding = { el: string; kind: 'contrast' | 'safe' | 'clipped' | 'offscreen' | 'tap' | 'legibility'; message: string; fix?: { prop: string; value: string } };
export type Surface = 'tv' | 'phone' | 'desktop';
const lin = (c: number): number => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (c: Rgb): number => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
export const contrastRatio = (a: Rgb, b: Rgb): number => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]; return (hi + 0.05) / (lo + 0.05); };
const over = (fg: Rgb & { a: number }, bg: Rgb): Rgb => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) });
const hex = (c: Rgb): string => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
/** White or black, whichever reads better on `bg` (the single safe colour fix). */
const readable = (bg: Rgb): string => (contrastRatio({ r: 255, g: 255, b: 255 }, bg) >= contrastRatio({ r: 0, g: 0, b: 0 }, bg) ? '#ffffff' : '#000000');
const MIN_TAP = { phone: 44, desktop: 24, tv: 0 } as const; // CSS px; TV is remote-driven
const MIN_TV_FONT = 24; // px at 1920 wide: about 3 m on a 55" TV
const isLarge = (n: AuditNode): boolean => n.fs >= 24; // WCAG large text (18.66px bold counts too, but weight is not reported: stay strict)

export function auditFacts(f: AuditFacts, surface: Surface): Finding[] {
  const out: Finding[] = [];
  for (const n of f.nodes) {
    if (n.w <= 0 || n.h <= 0) continue;
    if (n.text && n.color && n.bg && !n.bg.image) { // a background image makes the real backdrop unknowable: skip rather than guess
      const need = isLarge(n) ? 3 : 4.5; const r = contrastRatio(over(n.color, n.bg), n.bg);
      if (r < need) out.push({ el: n.id, kind: 'contrast', message: `"${n.text}" contrast ${r.toFixed(1)}:1, needs ${need}:1`, fix: { prop: 'color', value: readable(n.bg) } });
    }
    if (n.text && (n.clipX || n.clipY)) out.push({ el: n.id, kind: 'clipped', message: `"${n.text}" is cut off (${n.clipX ? 'width' : 'height'})` });
    if (n.text && (n.x + n.w < 0 || n.y + n.h < 0 || n.x > f.w || n.y > f.h)) out.push({ el: n.id, kind: 'offscreen', message: `"${n.text}" sits outside the frame` });
    if (surface === 'tv' && n.text && n.x + n.w > 0 && n.y + n.h > 0 && n.x < f.w && n.y < f.h && (n.x < f.w * 0.05 || n.y < f.h * 0.05 || n.x + n.w > f.w * 0.95 || n.y + n.h > f.h * 0.95)) out.push({ el: n.id, kind: 'safe', message: `"${n.text}" is inside the 5% overscan margin; TVs may crop it` });
    if (n.interactive && surface !== 'tv' && (n.w < MIN_TAP[surface] || n.h < MIN_TAP[surface])) out.push({ el: n.id, kind: 'tap', message: `${n.tag} is ${Math.round(n.w)}×${Math.round(n.h)}px, needs ${MIN_TAP[surface]}px`, fix: { prop: 'min-height', value: `${MIN_TAP[surface]}px` } });
    if (surface === 'tv' && n.text && n.fs > 0 && n.fs < MIN_TV_FONT) out.push({ el: n.id, kind: 'legibility', message: `"${n.text}" is ${Math.round(n.fs)}px, needs ${MIN_TV_FONT}px at 3 m`, fix: { prop: 'font-size', value: `${MIN_TV_FONT}px` } });
  }
  return out;
}
