import type { SayEvent, SayImage, SayTransport } from '../say/say';
/** Screenshot import: an image becomes an editable frame. Claude Code (vision, through the helper) rebuilds it as HTML; that HTML is sanitised here and then goes through the same pipeline as a captured page (captureToFrame, ids on every element). */
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const MIN_SCREENSHOT_PX = 200;
export const MAX_FRAME_W = 1920; export const MAX_FRAME_H = 5000;
export type ShotOk = { image: SayImage; size: { w: number; h: number } };
const u16 = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
/** Image type by file signature (never by file name). */
export function sniffType(b: Uint8Array): SayImage['mediaType'] | null {
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'; return null;
}
/** Pixel size read from the header: PNG IHDR, or the first JPEG start-of-frame segment. Null when the header is cut off or damaged. */
export function imageSize(b: Uint8Array): { w: number; h: number } | null {
  const t = sniffType(b); if (t === 'image/png') { if (b.length < 24) return null; const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); const w = dv.getUint32(16), h = dv.getUint32(20); return w > 0 && h > 0 ? { w, h } : null; }
  if (t === 'image/jpeg') { let i = 2; while (i + 9 < b.length) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]!; if (m === 0xff) { i++; continue; } if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { const h = u16(b, i + 5), w = u16(b, i + 7); return w > 0 && h > 0 ? { w, h } : null; } if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; } i += 2 + u16(b, i + 2); } }
  return null;
}
export const toBase64 = (b: Uint8Array): string => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
/** Check and read an image file's bytes. Every refusal says why (too big, wrong type, unreadable, too small). */
export function checkScreenshot(bytes: Uint8Array): { ok: true; value: ShotOk } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: 'That file is empty.' };
  if (bytes.length > MAX_SCREENSHOT_BYTES) return { ok: false, error: `That image is too big (${(bytes.length / 1048576).toFixed(2)} MB); the limit is 5 MB.` };
  const type = sniffType(bytes); if (!type) return { ok: false, error: 'Only PNG or JPEG screenshots work.' };
  const size = imageSize(bytes); if (!size) return { ok: false, error: 'That image could not be read (damaged or cut off).' };
  if (size.w < MIN_SCREENSHOT_PX || size.h < MIN_SCREENSHOT_PX) return { ok: false, error: `That image is ${size.w}×${size.h}px; it must be at least ${MIN_SCREENSHOT_PX}×${MIN_SCREENSHOT_PX}.` };
  return { ok: true, value: { image: { mediaType: type, data: toBase64(bytes) }, size } };
}
export async function readScreenshot(file: Blob): Promise<ReturnType<typeof checkScreenshot>> {
  if (file.size > MAX_SCREENSHOT_BYTES) return { ok: false, error: `That image is too big (${(file.size / 1048576).toFixed(2)} MB); the limit is 5 MB.` }; // before reading it into memory
  let bytes: Uint8Array; try { bytes = new Uint8Array(await file.arrayBuffer()); } catch { return { ok: false, error: 'That file could not be read.' }; } return checkScreenshot(bytes);
}
/** The frame size for an image: its own pixels, scaled down (never up) to at most 1920 × 5000. */
export function frameSizeFor(size: { w: number; h: number }): { w: number; h: number } { const k = Math.min(1, MAX_FRAME_W / size.w, MAX_FRAME_H / size.h); return { w: Math.round(size.w * k), h: Math.round(size.h * k) }; }
export function shotPrompt(size: { w: number; h: number }): { system: string; request: string } {
  return {
    system: ['You rebuild a screenshot of a user interface as HTML so a designer can edit it. Reply with ONLY the HTML: no markdown fence, no explanation.', 'Rules:',
      `- Exactly one root <div id="shot-root"> with style="position:relative;width:${size.w}px;height:${size.h}px;overflow:hidden;box-sizing:border-box;...". Everything is inside it.`,
      '- Inline style attributes only: no <style>, no <script>, no <link>, no event handlers (onclick...), no javascript: URLs.', '- Every element has a unique, meaningful id in kebab-case (header, hero-title, card-1-price ...).',
      '- No external URLs and no <img>: draw images and icons as coloured <div> blocks (or a simple inline <svg>); no web fonts: font-family system-ui, sans-serif.', '- Match the layout, text, colours, sizes and spacing of the screenshot as closely as you can; position blocks with flex or absolute layout in px.'].join('\n'),
    request: `Rebuild the attached screenshot (${size.w}×${size.h}px) as one editable HTML frame.`,
  };
}
const TAGS_OUT = 'script|iframe|object|embed|link|meta|base|form|noscript|template|frame|frameset|applet';
/** Remove everything that could run code or fetch anything: scripts, embeds, on*= handlers, javascript:/vbscript: and external URLs (attributes and CSS url()/@import). data:image URIs stay. */
export function sanitizeHtml(html: string): string {
  let s = html.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(new RegExp(`<(${TAGS_OUT})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi'), '').replace(new RegExp(`<\\/?(${TAGS_OUT})\\b[^>]*>`, 'gi'), '');
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/\s(href|src|srcset|poster|action|formaction|xlink:href|data)\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+)/gi, (m, _a: string, _v: string, d?: string, sq?: string, bare?: string) => { const v = (d ?? sq ?? bare ?? '').trim().replace(/[\s\u0000-\u001f]/g, '').toLowerCase(); return /^(https?:|\/\/|javascript:|vbscript:|data:(?!image\/(png|jpe?g|gif|webp|svg\+xml)[;,])|file:|ftp:)/.test(v) ? '' : m; });
  s = s.replace(/@import[^;}]*;?/gi, '').replace(/url\(\s*(["']?)\s*(https?:|\/\/|javascript:|file:|ftp:)[^)]*\)/gi, 'none').replace(/expression\([^)]*\)/gi, '');
  return s;
}
/** Claude's reply (maybe wrapped in prose or a code fence) -> one sanitised root div, or null when there is none. */
export function extractHtml(reply: string): string | null {
  const text = reply.replace(/```[a-zA-Z]*\n?/g, ''); const start = text.search(/<div\b/i), end = text.toLowerCase().lastIndexOf('</div>'); if (start < 0 || end < start) return null;
  const html = sanitizeHtml(text.slice(start, end + 6)).trim(); const elements = html.match(/<[a-zA-Z][^>]*>/g)?.length ?? 0; return /^<div\b/i.test(html) && /<\/div>$/i.test(html) && elements >= 1 && html.replace(/<[^>]*>/g, '').trim().length + elements > 1 ? html : null;
}
export type ShotResult = { ok: true; html: string } | { ok: false; error: string };
/** Send the image through the helper (to the local Claude Code) and collect the HTML. Errors from the helper, a timeout, an empty or unusable answer are all reported. */
export function rebuildScreenshot(send: SayTransport, shot: ShotOk, o: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<ShotResult> {
  const { system, request } = shotPrompt(frameSizeFor(shot.size)); let text = '';
  return new Promise((resolve) => {
    let settled = false; const finish = (r: ShotResult) => { if (!settled) { settled = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => finish({ ok: false, error: 'Claude took too long to rebuild the screenshot.' }), o.timeoutMs ?? 180000); o.signal?.addEventListener('abort', () => finish({ ok: false, error: 'cancelled' }), { once: true });
    send(system, request, (e: SayEvent) => {
      if (e.kind === 'delta') { text += e.text; return; }
      if (e.kind === 'error') return finish({ ok: false, error: `Claude could not rebuild it: ${e.text}` });
      const html = extractHtml(text); finish(html ? { ok: true, html } : { ok: false, error: text.trim() ? `Claude did not return usable HTML (it said: ${text.trim().slice(0, 100)}).` : 'Claude returned nothing usable.' });
    }, [shot.image]);
  });
}
