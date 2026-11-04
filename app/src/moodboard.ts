/** Moodboard: reference images for a direction (Spark). Pure module: validators, per-project storage, prompt text, dominant-color quantizer. Image bytes never enter a prompt (only notes + colors); no API key anywhere. */
export type Ref = { id: string; name: string; dataUrl?: string; note?: string; colors: string[] };
export type Moodboard = Ref[];
export const MAX_REFS = 8; export const MAX_DATA_URL = 200 * 1024; const MAX_NOTE = 300; const MAX_COLORS = 8;
const KEY = (project: string): string => `swift-canvas.moodboard.v1.${project}`;
const HEX = /^#[0-9a-f]{6}$/;
const str = (v: unknown, n: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= n;
const IMG = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
/** Untrusted storage/input -> a valid board (bad refs dropped, never the whole board; nothing truncated: an oversized image is dropped as a whole ref field). */
export function sanitizeMoodboard(raw: unknown): Moodboard {
  if (!Array.isArray(raw)) return []; const seen = new Set<string>(); const out: Moodboard = [];
  for (const x of raw) {
    const o = x as Partial<Ref> | null; if (out.length >= MAX_REFS || !str(o?.id, 60) || !str(o.name, 60) || seen.has(o.id)) continue; seen.add(o.id);
    const colors = Array.isArray(o.colors) ? [...new Set(o.colors.filter((c): c is string => typeof c === 'string' && HEX.test(c.toLowerCase())).map((c) => c.toLowerCase()))].slice(0, MAX_COLORS) : [];
    out.push({ id: o.id, name: o.name, ...(typeof o.dataUrl === 'string' && o.dataUrl.length <= MAX_DATA_URL && IMG.test(o.dataUrl) ? { dataUrl: o.dataUrl } : {}), ...(typeof o.note === 'string' && o.note.trim() ? { note: o.note.trim().slice(0, MAX_NOTE) } : {}), colors });
  }
  return out;
}
/** Add a reference (appended); a full board or an oversized/non-image dataUrl is refused with a reason, never truncated. */
export function addRef(board: Moodboard, ref: { name: string; dataUrl?: string; note?: string; colors?: string[] }): { ok: true; board: Moodboard } | { ok: false; error: string } {
  if (board.length >= MAX_REFS) return { ok: false, error: `moodboard is full (max ${MAX_REFS} references)` };
  if (ref.dataUrl !== undefined) { if (ref.dataUrl.length > MAX_DATA_URL) return { ok: false, error: `image too large (${Math.ceil(ref.dataUrl.length / 1024)} KB > ${MAX_DATA_URL / 1024} KB)` }; if (!IMG.test(ref.dataUrl)) return { ok: false, error: 'not a png, jpeg, webp or gif image' }; }
  const base = ref.name.trim().slice(0, 50) || 'reference'; let n = 1; let id = base; while (board.some((r) => r.id === id)) id = `${base}#${++n}`;
  const [clean] = sanitizeMoodboard([{ ...ref, id, name: base, colors: ref.colors ?? [] }]); if (!clean) return { ok: false, error: 'invalid reference' };
  return { ok: true, board: [...board, clean] };
}
export const removeRef = (board: Moodboard, id: string): Moodboard => board.filter((r) => r.id !== id);
type Store = Pick<Storage, 'getItem' | 'setItem'>; const safe = (): Store | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };
export function loadMoodboard(project: string, storage: Pick<Store, 'getItem'> | undefined = safe()): Moodboard { try { const raw = storage?.getItem(KEY(project)); return raw ? sanitizeMoodboard(JSON.parse(raw)) : []; } catch { return []; } }
export function saveMoodboard(project: string, board: Moodboard, storage: Pick<Store, 'setItem'> | undefined = safe()): string | null { try { if (!storage) return 'storage unavailable'; storage.setItem(KEY(project), JSON.stringify(board)); return null; } catch (e) { return e instanceof Error ? e.message : 'save failed'; } }
/** Short text block to append to the Spark/Say prompt: notes plus dominant colors, no image bytes. Empty board -> ''. */
export function moodboardPrompt(board: Moodboard): string {
  const refs = sanitizeMoodboard(board); if (!refs.length) return '';
  const lines = refs.map((r, i) => `${i + 1}. ${r.name}${r.note ? `: ${r.note.replace(/\s+/g, ' ')}` : ''}${r.colors.length ? ` (colors ${r.colors.join(' ')})` : ''}`);
  const all = new Map<string, number>(); for (const r of refs) r.colors.forEach((c, i) => all.set(c, (all.get(c) ?? 0) + MAX_COLORS - i));
  const palette = [...all].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);
  return `Moodboard (the user's reference images, described):\n${lines.join('\n')}${palette.length ? `\nOverall palette: ${palette.join(' ')}` : ''}\nUse the overall palette colours (exact hex values) for backgrounds, text or accents in your changes, while keeping this direction's own idea.`;
}
const hex = (n: number): string => n.toString(16).padStart(2, '0');
/** Up to k dominant colors (most frequent first) from RGBA pixels: 4 bits/channel buckets, transparent pixels ignored, near-duplicate buckets merged; returns bucket-mean colors as #rrggbb. */
export function dominantColors(px: Uint8ClampedArray, k: number): string[] {
  if (!(k >= 1)) return []; const b = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < px.length; i += 4) { const a = px[i + 3]!; if (a < 128) continue; const r = px[i]!, g = px[i + 1]!, bl = px[i + 2]!; const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (bl >> 4); const e = b.get(key); if (e) { e.n++; e.r += r; e.g += g; e.b += bl; } else b.set(key, { n: 1, r, g, b: bl }); }
  const out: { r: number; g: number; b: number }[] = [];
  for (const e of [...b.values()].sort((x, y) => y.n - x.n)) { const c = { r: Math.round(e.r / e.n), g: Math.round(e.g / e.n), b: Math.round(e.b / e.n) }; if (out.every((o) => Math.abs(o.r - c.r) + Math.abs(o.g - c.g) + Math.abs(o.b - c.b) > 48)) out.push(c); if (out.length >= Math.floor(k)) break; }
  return out.map((c) => `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`);
}
export const TYPE_SYSTEM = 'You are a typography-aware designer. Answer in one or two short plain sentences, nothing else.';
export const TYPE_PROMPT = 'Describe only the typography of this reference image so a designer can reproduce its feel: typeface style (serif, grotesque, mono, rounded...), weight, size contrast, letter-spacing, case. No colours, no layout, no markdown. Under 200 characters.';
/** Claude's answer -> a note: markdown and quotes stripped, whitespace collapsed, cut at the last full sentence inside 200 chars; null when empty. */
export function parseTypeCue(text: string): string | null {
  const t = text.replace(/[`*_#>]/g, '').replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim(); if (!t) return null; if (t.length <= 200) return t;
  const cut = t.slice(0, 200); const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; ')); return (dot > 60 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…').trim();
}
/** Set (or replace) one reference's note; returns the same board when the ref is gone. */
export const setNote = (board: Moodboard, id: string, note: string): Moodboard => (board.some((r) => r.id === id) ? board.map((r) => (r.id === id ? { ...r, note: note.slice(0, MAX_NOTE) } : r)) : board);
