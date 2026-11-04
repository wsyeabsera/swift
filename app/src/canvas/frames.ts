import { captureToFrame } from './capture';
import type { FrameDef } from './fixtures';
/** Duplicate: a copy of `base` with its current HTML, placed to the right of everything so it never lands on another frame. */
export function duplicateFrame(frames: FrameDef[], base: FrameDef, id: string, html: string): FrameDef {
  const right = frames.reduce((m, f) => Math.max(m, f.x + f.w), base.x + base.w);
  return { id, root: base.root, title: `${base.title} copy`, x: right + 140, y: base.y, w: base.w, h: base.h, html };
}
/** `<id>-d<n>` with the smallest free n (a duplicate of a duplicate keeps the original's id as stem). */
export function duplicateId(frames: FrameDef[], baseId: string): string {
  const stem = baseId.replace(/-d\d+$/, ''); const used = new Set(frames.map((f) => f.id)); let n = 1; while (used.has(`${stem}-d${n}`)) n++; return `${stem}-d${n}`;
}
/** Rename: trimmed, capped at 60 chars; an empty name keeps the old one. Returns the same array when nothing changes. */
export function renameFrame(frames: FrameDef[], id: string, title: string): FrameDef[] {
  const t = title.trim().slice(0, 60); const f = frames.find((x) => x.id === id); if (!f || !t || t === f.title) return frames; return frames.map((x) => (x.id === id ? { ...x, title: t } : x));
}
export const PRESETS = { phone: { w: 390, h: 844, label: 'Phone 390' }, desktop: { w: 1280, h: 800, label: 'Desktop 1280' }, browser: { w: 1440, h: 900, label: 'Browser 1440' }, popup: { w: 360, h: 520, label: 'Popup 360' }, email: { w: 600, h: 800, label: 'Email 600' }, tv: { w: 1920, h: 1080, label: 'TV 1920' } } as const;
export type PresetKey = keyof typeof PRESETS;
export type Surface = 'tv' | 'phone' | 'desktop';
const SURFACE_OF: Record<PresetKey, Surface> = { phone: 'phone', desktop: 'desktop', browser: 'desktop', popup: 'desktop', email: 'desktop', tv: 'tv' }; // a popup is narrow but pointer-driven: desktop rules, not phone
/** Which device rules apply to a frame: its preset when its id says so (`popup-2`), else a guess from its width (captured pages, imports). */
export function surfaceOf(f: { id: string; w: number }): Surface { const k = /^([a-z]+)-\d+$/.exec(f.id)?.[1]; if (k && k in SURFACE_OF) return SURFACE_OF[k as PresetKey]; return f.w >= 1600 ? 'tv' : f.w <= 500 ? 'phone' : 'desktop'; }
/** A new empty frame of a preset size, right of everything. Ids are `<preset>-<n>` (smallest free n) and double as the root element id, so Say can address it. */
export function newFrame(frames: FrameDef[], kind: PresetKey): FrameDef {
  const p = PRESETS[kind]; const used = new Set(frames.map((f) => f.id)); let n = 1; while (used.has(`${kind}-${n}`)) n++; const id = `${kind}-${n}`;
  const right = frames.reduce((m, f) => Math.max(m, f.x + f.w), 0); const top = frames.reduce((m, f) => Math.min(m, f.y), 0);
  const html = `<div id="${id}" style="position:relative;width:${p.w}px;height:${p.h}px;overflow:hidden;font-family:system-ui;color:#f5f5f7;background:#14151a"><div id="${id}-title" style="position:absolute;left:${Math.round(p.w * 0.06)}px;top:${Math.round(p.h * 0.06)}px;font-size:${Math.round(p.w * 0.04)}px;font-weight:600">New ${kind}</div></div>`;
  return { id, root: id, title: `${p.label} ${n}`, x: frames.length ? right + 140 : 0, y: frames.length ? top : 0, w: p.w, h: p.h, html };
}

/** A captured page (helper HTML) as a new frame to the right of the others: `cap-1`, `cap-2`, … */
export function capturedFrame(frames: FrameDef[], pageHtml: string, url: string, size?: { w: number; h: number }, fullPage = false): FrameDef {
  const used = new Set(frames.map((f) => f.id)); let n = 1; while (used.has(`cap-${n}`)) n++; const c = captureToFrame(pageHtml, size, fullPage); let host = url; try { host = new URL(url).host; } catch { /* keep the raw text */ }
  const right = frames.reduce((m, f) => Math.max(m, f.x + f.w), 0); const top = frames.reduce((m, f) => Math.min(m, f.y), 0);
  return { id: `cap-${n}`, root: c.root, title: `Page ${host}`, x: frames.length ? right + 140 : 0, y: frames.length ? top : 0, w: c.w, h: c.h, html: c.html };
}
