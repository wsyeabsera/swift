/**
 * Smart template = a folder: `template.json` (manifest) + `frames/<file>.html`. Frame HTML holds `{{slot-id}}` placeholders; slots carry a type, a default and a Say prompt, so Claude can fill them from one line.
 * Untrusted input (a folder from disk, a repo, a download): everything is checked, all-or-nothing, with size caps and no active content (like `sanitizeLibrary`/`parseProjectFile`).
 * Pure module (no fs): `templateSources.ts` reads folders into the `TemplateFolder` shape.
 */
import { isColorValue, toBrandTokens } from './brand';
import type { FrameDef } from './canvas/fixtures';
export const TEMPLATE_VERSION = 1;
export const MAX_MANIFEST = 64 * 1024; export const MAX_FRAME_HTML = 200_000; export const MAX_TOTAL = 1024 * 1024;
export const MAX_SLOTS = 40; export const MAX_FRAMES = 12; export const MAX_TOKENS = 64; export const MAX_LIST = 30; export const MAX_TEXT = 2000;
export type SlotType = 'text' | 'list' | 'image' | 'color';
export type Slot = { id: string; type: SlotType; label: string; prompt: string; default: string | string[]; required: boolean };
export type TemplateFrame = { id: string; title: string; root: string; w: number; h: number; x?: number; y?: number; html: string };
export type Template = { name: string; description: string; slots: Slot[]; tokens: Record<string, string>; frames: TemplateFrame[] };
/** A template folder in memory: relative path ("template.json", "frames/hero.html") -> text. */
export type TemplateFolder = { files: Record<string, string> };
export type Result<T> = { ok: true; value: T; warnings: string[] } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const SLOT_ID = /^[a-z][a-z0-9-]{0,39}$/; const FRAME_FILE = /^[a-z0-9][a-z0-9._-]{0,60}\.html$/i; const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9-]*)\s*\}\}/g;
const TYPES: readonly SlotType[] = ['text', 'list', 'image', 'color'];
const FRAME_ID = /^[A-Za-z][\w-]{0,39}$/;
/** No active or external-loading content in a template frame. */
const FORBIDDEN: [RegExp, string][] = [[/<\s*(script|iframe|object|embed|link|meta|base|form|frame|frameset)\b/i, 'a forbidden element'], [/\son[a-z]+\s*=/i, 'an event handler attribute'], [/(java|vb)script\s*:/i, 'a script URL'], [/@import\b/i, '@import'], [/<\s*style[^>]*>[^<]*url\(\s*['"]?\s*(https?:)?\/\//i, 'an external stylesheet url()']];
export const unsafeReason = (html: string): string | null => { for (const [re, why] of FORBIDDEN) if (re.test(html)) return why; return null; };
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const imageOk = (v: string): boolean => v.length <= MAX_TEXT * 50 && (/^https:\/\/[^\s"'<>]+$/i.test(v) || /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(v));
/** Is this value valid for a slot of this type? Returns a reason or null. */
export function slotValueError(slot: Slot, v: unknown): string | null {
  switch (slot.type) {
    case 'text': return typeof v === 'string' && v.length <= MAX_TEXT ? null : `${slot.id}: text up to ${MAX_TEXT} characters`;
    case 'list': return Array.isArray(v) && v.length <= MAX_LIST && v.every((x) => typeof x === 'string' && x.length <= MAX_TEXT) ? null : `${slot.id}: a list of up to ${MAX_LIST} texts`;
    case 'image': return typeof v === 'string' && imageOk(v) ? null : `${slot.id}: an https:// or data:image URL`;
    case 'color': return typeof v === 'string' && isColorValue(v) ? null : `${slot.id}: a colour (#hex, rgb(), hsl() or oklch())`;
  }
}
function parseSlot(raw: unknown, i: number): { ok: true; slot: Slot } | { ok: false; error: string } {
  const o = raw as Record<string, unknown>; if (typeof raw !== 'object' || raw === null) return fail(`slot ${i + 1} is not an object`);
  if (typeof o.id !== 'string' || !SLOT_ID.test(o.id)) return fail(`slot ${i + 1} needs an id like "headline" (lowercase, digits, dashes)`);
  if (!TYPES.includes(o.type as SlotType)) return fail(`slot ${o.id}: type must be one of ${TYPES.join(', ')}`);
  const type = o.type as SlotType; const slot: Slot = { id: o.id, type, label: isStr(o.label, 60) ? o.label : o.id, prompt: typeof o.prompt === 'string' ? o.prompt.slice(0, 300) : '', default: type === 'list' ? [] : '', required: o.required === true };
  if (o.default !== undefined) { const e = slotValueError(slot, o.default); if (e) return fail(`default of ${e}`); slot.default = o.default as string | string[]; }
  else if (type === 'image' || type === 'color') slot.default = '';
  if ((type === 'image' || type === 'color') && slot.default === '' && o.default === undefined) slot.required = true; // no safe value to fall back to
  return { ok: true, slot };
}
/** Manifest + frame files -> a valid template, or the first reason it was refused. Unused slots are warnings; a placeholder without a slot is an error. */
export function parseTemplate(folder: TemplateFolder): Result<Template> {
  const files = folder.files; const manifestText = files['template.json']; if (manifestText === undefined) return fail('template.json is missing');
  if (manifestText.length > MAX_MANIFEST) return fail(`template.json too large (${manifestText.length} > ${MAX_MANIFEST})`);
  if (Object.values(files).reduce((n, t) => n + t.length, 0) > MAX_TOTAL) return fail(`template folder too large (> ${MAX_TOTAL} characters)`);
  let raw: unknown; try { raw = JSON.parse(manifestText); } catch { return fail('template.json is not JSON'); }
  const o = (typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : null) as Record<string, unknown> | null; if (!o) return fail('template.json must be an object');
  if (o.swiftCanvasTemplate !== TEMPLATE_VERSION) return fail('not a Swift Canvas template (swiftCanvasTemplate must be 1, or this is a newer version)');
  if (!isStr(o.name, 60) || !o.name.trim()) return fail('name is required (up to 60 characters)');
  const description = typeof o.description === 'string' ? o.description.slice(0, 300) : '';
  const rawSlots = o.slots === undefined ? [] : o.slots; if (!Array.isArray(rawSlots) || rawSlots.length > MAX_SLOTS) return fail(`slots must be a list of at most ${MAX_SLOTS}`);
  const slots: Slot[] = []; const slotIds = new Set<string>();
  for (let i = 0; i < rawSlots.length; i++) { const r = parseSlot(rawSlots[i], i); if (!r.ok) return r; if (slotIds.has(r.slot.id)) return fail(`duplicate slot "${r.slot.id}"`); slotIds.add(r.slot.id); slots.push(r.slot); }
  const rawTokens = o.tokens === undefined ? {} : o.tokens; if (typeof rawTokens !== 'object' || rawTokens === null || Array.isArray(rawTokens)) return fail('tokens must be an object of "--name": "value"');
  const entries = Object.entries(rawTokens); if (entries.length > MAX_TOKENS) return fail(`too many tokens (> ${MAX_TOKENS})`);
  const tokens = toBrandTokens(entries.map(([name, value]) => ({ name, value: String(value) })));
  const bad = entries.find(([n, v]) => typeof v !== 'string' || tokens[n] === undefined); if (bad) return fail(`token ${bad[0]} is not a plain "--name": "value" (no ; { } < > \\, up to 60 characters)`);
  if (!Array.isArray(o.frames) || o.frames.length === 0 || o.frames.length > MAX_FRAMES) return fail(`frames must be a list of 1 to ${MAX_FRAMES}`);
  const frames: TemplateFrame[] = []; const frameIds = new Set<string>(); const used = new Set<string>(); const warnings: string[] = [];
  for (const [i, rf] of o.frames.entries()) {
    const f = rf as Record<string, unknown>; if (typeof rf !== 'object' || rf === null) return fail(`frame ${i + 1} is not an object`);
    if (typeof f.id !== 'string' || !FRAME_ID.test(f.id)) return fail(`frame ${i + 1} needs an id`); if (frameIds.has(f.id)) return fail(`duplicate frame "${f.id}"`); frameIds.add(f.id);
    if (typeof f.file !== 'string' || !FRAME_FILE.test(f.file)) return fail(`frame ${f.id}: file must be a plain name like "hero.html" inside frames/`);
    const html = files[`frames/${f.file}`]; if (html === undefined) return fail(`frame ${f.id}: frames/${f.file} is missing`);
    if (!html.trim()) return fail(`frame ${f.id}: frames/${f.file} is empty`); if (html.length > MAX_FRAME_HTML) return fail(`frame ${f.id}: frames/${f.file} too large (${html.length} > ${MAX_FRAME_HTML})`);
    const why = unsafeReason(html); if (why) return fail(`frame ${f.id}: frames/${f.file} contains ${why}`);
    const w = f.w, h = f.h; if (typeof w !== 'number' || typeof h !== 'number' || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 || w > 20000 || h > 20000) return fail(`frame ${f.id}: w and h must be positive numbers`);
    const root = f.root === undefined ? /\bid="([^"{}]+)"/.exec(html)?.[1] : f.root; if (typeof root !== 'string' || !html.includes(`id="${root}"`)) return fail(`frame ${f.id}: no root element (an element with id="${String(root ?? '')}")`);
    for (const m of html.matchAll(PLACEHOLDER)) { if (!slotIds.has(m[1]!)) return fail(`frame ${f.id}: {{${m[1]}}} has no slot in template.json`); used.add(m[1]!); }
    const x = f.x, y = f.y; if ((x !== undefined && (typeof x !== 'number' || !Number.isFinite(x))) || (y !== undefined && (typeof y !== 'number' || !Number.isFinite(y)))) return fail(`frame ${f.id}: x and y must be numbers`);
    frames.push({ id: f.id, title: isStr(f.title, 80) ? f.title : f.id, root, w, h, ...(x !== undefined ? { x: x as number } : {}), ...(y !== undefined ? { y: y as number } : {}), html });
  }
  for (const s of slots) if (!used.has(s.id)) warnings.push(`slot "${s.id}" is not used in any frame`);
  return { ok: true, value: { name: o.name.trim(), description, slots, tokens, frames }, warnings };
}
const renderValue = (slot: Slot, v: string | string[]): string => (slot.type === 'list' ? (v as string[]).map((x) => `<li>${esc(x)}</li>`).join('') : esc(String(v)));
/** Fill the slots (given values over defaults) and place the frames. Unknown slots, bad values and missing required slots are errors; nothing is partially filled. */
export function instantiateTemplate(t: Template, values: Record<string, unknown> = {}): Result<{ frames: FrameDef[]; tokens: Record<string, string> }> {
  const byId = new Map(t.slots.map((s) => [s.id, s])); const merged = new Map<string, string | string[]>();
  for (const k of Object.keys(values)) if (!byId.has(k)) return fail(`unknown slot "${k}" (slots: ${t.slots.map((s) => s.id).join(', ') || 'none'})`);
  for (const s of t.slots) {
    const given = values[s.id]; const v = given === undefined ? s.default : given; const empty = v === '' || (Array.isArray(v) && v.length === 0);
    if (given === undefined && empty && s.required) return fail(`slot "${s.id}" needs a value${s.prompt ? `: ${s.prompt}` : ''}`);
    if (given !== undefined || !empty) { const e = slotValueError(s, v); if (e) return fail(e); }
    merged.set(s.id, v as string | string[]);
  }
  let nextX = 0; const frames: FrameDef[] = t.frames.map((f) => {
    const x = f.x ?? nextX; nextX = x + f.w + 120; const html = f.html.replace(PLACEHOLDER, (_m, id: string) => renderValue(byId.get(id)!, merged.get(id)!));
    return { id: f.id, root: f.root, title: f.title, x, y: f.y ?? 0, w: f.w, h: f.h, html };
  });
  return { ok: true, value: { frames, tokens: { ...t.tokens } }, warnings: [] };
}
/** The slot list a filler (Claude) works from: id, type, what to write, current default. */
export const describeSlots = (t: Template): { id: string; type: SlotType; label: string; prompt: string; default: string | string[]; required: boolean }[] => t.slots.map((s) => ({ ...s }));
