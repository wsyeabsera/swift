/**
 * Save as template (#1835): build a template folder (the #1832 shape) from frames on the canvas, or from a repo's scanned tokens.
 * Pure: returns a `TemplateFolder` that has already passed `parseTemplate` and whose default fill re-creates the original text; the helper writes the files.
 * Selection -> template: every plain text node becomes a `text` slot (default = the original text), runs of bare `<li>text</li>` become a `list` slot.
 */
import { toBrandTokens } from './brand';
import type { FrameDef } from './canvas/fixtures';
import { instantiateTemplate, MAX_FRAME_HTML, MAX_FRAMES, MAX_LIST, MAX_SLOTS, MAX_TEXT, parseTemplate, unsafeReason, type Slot, type TemplateFolder } from './template';

export type SaveResult = { ok: true; slug: string; name: string; folder: TemplateFolder; slots: number; warnings: string[] } | { ok: false; error: string };
export type ScanLike = { tokens: { name: string; value: string }[]; colors: { value: string; count: number }[]; fonts: { value: string; count: number }[] };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Folder name for a template: lowercase, dashes, up to 40 characters; null when nothing usable is left. */
export function slugify(name: string): string | null { const s = name.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, ''); return s || null; }
const kebab = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const title = (s: string): string => { const t = s.replace(/[-_]+/g, ' ').trim(); return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 60); };
const DECODE: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
/** Text with only the five plain entities decodes; any other entity (or a stray `&`/quote/brace pair) keeps the text literal in the template. */
const decodePlain = (s: string): string | null => { if (/&(?!amp;|lt;|gt;|quot;|#39;)[#\w]*;/.test(s)) return null; const d = s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => DECODE[m]!); return /[>"]|\{\{|\}\}/.test(s) ? null : d; };
const TOKEN = /(<!--[\s\S]*?-->|<[^>]*>)/;
const SKIP_TEXT = /^<\s*(style|script|textarea|title)\b/i;

type Ctx = { slots: Slot[]; used: Set<string>; prefix: string };
function slotId(ctx: Ctx, base: string): string | null {
  if (ctx.slots.length >= MAX_SLOTS) return null;
  const root = kebab(`${ctx.prefix}${ctx.prefix ? '-' : ''}${base}`).replace(/^[^a-z]+/, '').slice(0, 34).replace(/-+$/, '') || 'text';
  let id = root; for (let n = 2; ctx.used.has(id); n++) id = `${root}-${n}`; ctx.used.add(id); return id;
}
const hint = (s: string): string => `Replace "${s.length > 40 ? s.slice(0, 40) + '...' : s}" with text of about ${s.length} characters`;
/** One frame's HTML with its text turned into placeholders; slots are appended to ctx. */
function slotify(html: string, ctx: Ctx): string {
  const parts = html.split(TOKEN); let label = 'text'; let skip = false; const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (i % 2 === 1) { // a tag or comment
      out.push(p); if (p.startsWith('<!--')) continue;
      if (SKIP_TEXT.test(p)) skip = true; else if (/^<\s*\/\s*(style|script|textarea|title)\b/i.test(p)) skip = false;
      else if (p[1] !== '/') { label = /\bid="([^"{}]+)"/.exec(p)?.[1] ?? /^<\s*([a-z][a-z0-9]*)/i.exec(p)?.[1] ?? label; }
      continue;
    }
    // a run of bare <li>text</li> (2+) becomes one list slot
    const items = liRun(parts, i);
    if (items) {
      const id = slotId(ctx, label + '-items');
      if (id) { ctx.slots.push({ id, type: 'list', label: title(`${label} items`), prompt: `A list of ${items.values.length} short items (like the current ones)`, default: items.values, required: false }); out.push(`{{${id}}}`); i = items.end; continue; }
    }
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(p)!; const raw = m[2]!;
    if (skip || !raw || !/[\p{L}\p{N}]/u.test(raw) || raw.length > MAX_TEXT) { out.push(p); continue; }
    const text = decodePlain(raw); const id = text === null ? null : slotId(ctx, label);
    if (text === null || id === null) { out.push(p); continue; }
    ctx.slots.push({ id, type: 'text', label: title(id.replace(/-\d+$/, '')), prompt: hint(text), default: text, required: false });
    out.push(`${m[1]}{{${id}}}${m[3]}`);
  }
  return out.join('');
}
/** parts[i] is a text part right after `<ul|ol ...>`: if `<li>x</li>` x2+ (bare tags, plain text, only whitespace between) follows, return the values and the index of the last part consumed. */
function liRun(parts: string[], i: number): { values: string[]; end: number } | null {
  if (parts[i]!.trim() !== '' || !/^<\s*(ul|ol)\b/i.test(parts[i - 1] ?? '')) return null;
  const values: string[] = []; let j = i + 1;
  while (parts[j] !== undefined && /^<li>$/i.test(parts[j]!) && parts[j + 2] !== undefined && /^<\/li>$/i.test(parts[j + 2]!)) {
    const t = decodePlain(parts[j + 1]!.trim()); if (t === null || !t || t.length > MAX_TEXT || parts[j + 1]!.trim() !== parts[j + 1]) break; values.push(t); j += 3;
    if (parts[j] !== undefined && parts[j]!.trim() === '' && /^<li>$/i.test(parts[j + 1] ?? '')) j += 1; else break;
  }
  if (parts[j] !== undefined && parts[j]!.trim() === '') j += 1; // whitespace before </ul>
  if (values.length < 2 || values.length > MAX_LIST || !/^<\s*\/\s*(ul|ol)\b/i.test(parts[j] ?? '')) return null;
  return { values, end: j - 1 };
}
const canon = (h: string): string => h.replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').replace(/> </g, '><').replace(/>\s+|\s+</g, (m) => m.trim());

const rootTokens = (f: FrameDef): { name: string; value: string }[] => {
  const tag = new RegExp(`<[^>]*\\bid="${f.root.replace(/[^\w-]/g, '')}"[^>]*>`).exec(f.html)?.[0] ?? ''; const style = /\bstyle="([^"]*)"/.exec(tag)?.[1] ?? '';
  return [...style.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+)/gi)].map((m) => ({ name: m[1]!, value: m[2]!.trim() }));
};
export type FromFramesOpts = { name: string; description?: string; tokens?: Record<string, string> };
/** Frames (the selected one, or several) -> a template folder. Fails with a reason; never writes a template that does not re-create the original with its own defaults. */
export function templateFromFrames(frames: FrameDef[], opts: FromFramesOpts): SaveResult {
  const name = opts.name.trim(); const slug = slugify(name); if (!name || !slug) return fail('give the template a name (letters or digits)');
  if (frames.length === 0) return fail('nothing to save: select a frame'); if (frames.length > MAX_FRAMES) return fail(`too many frames (${frames.length} > ${MAX_FRAMES})`);
  const slots: Slot[] = []; const used = new Set<string>(); const files: Record<string, string> = {}; const manifestFrames: Record<string, unknown>[] = []; const fileNames = new Set<string>();
  for (const f of frames) {
    if (f.html.length > MAX_FRAME_HTML) return fail(`frame ${f.id} is too large to save (${f.html.length} > ${MAX_FRAME_HTML})`);
    const why = unsafeReason(f.html); if (why) return fail(`frame ${f.id} contains ${why}, which templates do not allow`);
    if (/\{\{|\}\}/.test(f.html)) return fail(`frame ${f.id} contains "{{", which templates use for slots`);
    if (!f.html.includes(`id="${f.root}"`)) return fail(`frame ${f.id} has no root element id="${f.root}"`);
    let file = `${kebab(f.id) || 'frame'}.html`; for (let n = 2; fileNames.has(file); n++) file = `${kebab(f.id) || 'frame'}-${n}.html`; fileNames.add(file);
    const html = slotify(f.html, { slots, used, prefix: frames.length > 1 ? kebab(f.id).slice(0, 10) : '' });
    files[`frames/${file}`] = html; manifestFrames.push({ id: f.id, title: f.title, file, w: f.w, h: f.h, x: f.x, y: f.y, root: f.root });
  }
  const fromRoots = frames.flatMap((f) => rootTokens(f)); // custom properties set on a frame root (set_token / retheme) travel with it
  const tokens = toBrandTokens([...fromRoots, ...Object.entries(opts.tokens ?? {}).map(([n, value]) => ({ name: n, value }))]);
  files['template.json'] = JSON.stringify({ swiftCanvasTemplate: 1, name, description: (opts.description ?? '').slice(0, 300), slots, tokens, frames: manifestFrames }, null, 2);
  return verify({ files }, slug, name, frames);
}
/** The saved folder must pass the validator and, filled with its defaults, give back the original frames (up to whitespace and equal escapes). */
function verify(folder: TemplateFolder, slug: string, name: string, original: FrameDef[] | null): SaveResult {
  const t = parseTemplate(folder); if (!t.ok) return fail(`the template did not validate: ${t.error}`);
  if (original) {
    const i = instantiateTemplate(t.value); if (!i.ok) return fail(`the template did not fill with its own defaults: ${i.error}`);
    for (const [k, f] of i.value.frames.entries()) if (canon(f.html) !== canon(original[k]!.html)) return fail(`frame ${f.id} would not round-trip (its markup is too unusual to templatise); try another frame`);
  }
  return { ok: true, slug, name: t.value.name, folder, slots: t.value.slots.length, warnings: t.warnings };
}

const lum = (hex: string): number => { const h = hex.replace('#', ''); const f = h.length <= 4 ? [...h].map((c) => c + c).join('') : h; const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
const find = (tokens: Record<string, string>, re: RegExp): string | undefined => Object.keys(tokens).find((n) => re.test(n));
/** A repo's scanned tokens/colours/fonts -> a small starter template whose tokens are the repo's brand (so a new project starts in it). */
export function templateFromScan(scan: ScanLike, opts: { name: string; description?: string }): SaveResult {
  const name = opts.name.trim(); const slug = slugify(name); if (!name || !slug) return fail('give the template a name (letters or digits)');
  const tokens = toBrandTokens(scan.tokens); const hexes = scan.colors.map((c) => c.value).filter((v) => /^#[0-9a-f]{6}$/i.test(v)).slice(0, 6);
  if (Object.keys(tokens).length === 0 && hexes.length === 0) return fail('the scan found no design tokens or colours to build a brand from');
  const byLum = [...hexes].sort((a, b) => lum(a) - lum(b));
  const pickTok = (re: RegExp, fallback: string | undefined): string => { const n = find(tokens, re); return n ? `var(${n})` : fallback ?? '#888888'; };
  const bg = pickTok(/(^--(bg|background|surface)\b)|bg/i, byLum[0]); const ink = pickTok(/(^--(ink|text|fg|foreground)\b)|ink|text|fg/i, byLum[byLum.length - 1]);
  const accentTok = find(tokens, /accent|primary|brand|(^--ac$)/i); const accent = accentTok ?? hexes.find((h) => h !== byLum[0] && h !== byLum[byLum.length - 1]) ?? ink;
  const font = scan.fonts[0]?.value; const fontTok = find(tokens, /font(-(ui|sans|body|family))?$/i); const family = fontTok ? `var(${fontTok})` : font && /^[\w ,'-]{1,60}$/.test(font) ? `'${font.replace(/'/g, '')}', system-ui, sans-serif` : 'system-ui, sans-serif';
  if (Object.keys(tokens).length === 0) { hexes.forEach((h, i) => { tokens[`--color-${i + 1}`] = h; }); if (font) tokens['--font-1'] = font; }
  const accentLiteral = /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#0a84ff';
  const slots: Slot[] = [
    { id: 'headline', type: 'text', label: 'Headline', prompt: 'The main promise, in one line', default: 'Your headline here', required: false },
    { id: 'points', type: 'list', label: 'Points', prompt: 'Three short selling points', default: ['Fast', 'Clear', 'Yours'], required: false },
  ];
  if (!accentTok) slots.push({ id: 'accent', type: 'color', label: 'Accent', prompt: 'Accent colour for the button', default: accentLiteral, required: false });
  const accentUse = accentTok ? `var(${accentTok})` : '{{accent}}';
  const html = `<div id="home" style="width:1280px;height:800px;box-sizing:border-box;padding:96px;background:${bg};color:${ink};font-family:${family}"><h1 style="margin:0 0 24px;font-size:56px">{{headline}}</h1><ul style="margin:0 0 32px;padding-left:24px;font-size:24px">{{points}}</ul><div style="display:inline-block;padding:14px 28px;border-radius:12px;background:${accentUse};color:${bg}">Get started</div></div>`;
  const files = { 'template.json': JSON.stringify({ swiftCanvasTemplate: 1, name, description: (opts.description ?? 'Starter in the colours and fonts of your repo').slice(0, 300), slots, tokens, frames: [{ id: 'home', title: 'Home', file: 'home.html', w: 1280, h: 800 }] }, null, 2), 'frames/home.html': html };
  return verify({ files }, slug, name, null);
}
