import { expect, test } from 'vitest';
import { captureToFrame } from './capture';
import { capturedFrame } from './frames';
import { checkScreenshot, extractHtml, frameSizeFor, imageSize, MAX_SCREENSHOT_BYTES, readScreenshot, rebuildScreenshot, sanitizeHtml, shotPrompt, sniffType } from './screenshot';
import type { SayEvent, SayTransport } from '../say/say';
const png = (w: number, h: number, extra = 0): Uint8Array => { const b = new Uint8Array(33 + extra); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); const dv = new DataView(b.buffer); dv.setUint32(16, w); dv.setUint32(20, h); return b; };
const jpeg = (w: number, h: number): Uint8Array => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0, 0xff, 0xd9]);
test('type and size come from the file bytes', () => {
  expect(sniffType(png(10, 10))).toBe('image/png'); expect(sniffType(jpeg(10, 10))).toBe('image/jpeg'); expect(sniffType(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  expect(imageSize(png(1280, 720))).toEqual({ w: 1280, h: 720 }); expect(imageSize(jpeg(640, 480))).toEqual({ w: 640, h: 480 }); expect(imageSize(png(0, 5))).toBeNull(); expect(imageSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
});
test('validation: too small, too big, wrong type, unreadable, empty each say why', () => {
  const ok = checkScreenshot(png(1280, 800)); expect(ok.ok).toBe(true); if (ok.ok) { expect(ok.value.size).toEqual({ w: 1280, h: 800 }); expect(ok.value.image.mediaType).toBe('image/png'); expect(atob(ok.value.image.data).charCodeAt(1)).toBe(0x50); }
  expect(checkScreenshot(jpeg(800, 600)).ok).toBe(true); expect(checkScreenshot(png(200, 200)).ok).toBe(true);
  for (const [bytes, re] of [[png(199, 800), /199×800.*at least 200/], [png(800, 150), /800×150/], [png(1280, 800, MAX_SCREENSHOT_BYTES), /too big.*the limit is 5 MB/], [new Uint8Array([1, 2, 3, 4, 5]), /PNG or JPEG/], [new Uint8Array(0), /empty/], [png(1, 1).slice(0, 20), /could not be read/]] as const) { const r = checkScreenshot(bytes); expect(r.ok).toBe(false); if (!r.ok) expect(r.error).toMatch(re); }
});
test('a file over 5 MB is refused before it is read', async () => { const big = { size: MAX_SCREENSHOT_BYTES + 1, arrayBuffer: () => { throw new Error('must not read'); } } as unknown as Blob; const r = await readScreenshot(big); expect(r).toMatchObject({ ok: false }); const bad = { size: 10, arrayBuffer: () => Promise.reject(new Error('denied')) } as unknown as Blob; expect(await readScreenshot(bad)).toEqual({ ok: false, error: 'That file could not be read.' }); expect((await readScreenshot(new Blob([png(300, 300) as BlobPart]))).ok).toBe(true); });
test('frame size keeps pixels, scales big images down only', () => { expect(frameSizeFor({ w: 1280, h: 800 })).toEqual({ w: 1280, h: 800 }); expect(frameSizeFor({ w: 3840, h: 2160 })).toEqual({ w: 1920, h: 1080 }); expect(frameSizeFor({ w: 1000, h: 10000 })).toEqual({ w: 500, h: 5000 }); });
test('the prompt asks for one root div, ids, inline styles, no scripts or external URLs', () => { const p = shotPrompt({ w: 1280, h: 800 }); expect(p.system).toContain('<div id="shot-root"'); expect(p.system).toContain('width:1280px;height:800px'); expect(p.system).toMatch(/unique, meaningful id/); expect(p.system).toMatch(/no <script>/i); expect(p.system).toMatch(/No external URLs/); expect(p.request).toContain('1280×800'); });
test('sanitising strips scripts, handlers, javascript: and external URLs', () => {
  const dirty = `<div id="a" onclick="x()" onmouseover='y()' style="background:url(https://evil.test/a.png) , url(//evil.test/b)"><script>alert(1)</script><script src="https://evil.test/x.js"></script><a id="l" href="javascript:alert(1)">x</a><a id="m" href=" JaVa\tScript:alert(1)">m</a><img id="i" src="http://evil.test/i.png" srcset="http://evil.test/i2.png 2x"><iframe src="https://evil.test"></iframe><link rel="stylesheet" href="https://evil.test/c.css"><style>@import url(https://evil.test/s.css); .a{background:url(http://evil.test/z)}</style><object data="x"></object><form action="https://evil.test"><input id="in"></form><p id="ok" style="color:#fff;background:url(data:image/png;base64,AAAA)">fine</p><!-- c --></div>`;
  const clean = sanitizeHtml(dirty); for (const bad of ['<script', 'onclick', 'onmouseover', 'javascript', 'evil.test', '<iframe', '<link', '<object', '<form', '@import', '<!--']) expect(clean.toLowerCase()).not.toContain(bad.toLowerCase());
  expect(clean).toContain('id="ok"'); expect(clean).toContain('data:image/png;base64,AAAA'); expect(clean).toContain('fine'); expect(clean).toContain('<a id="l">');
});
test('extractHtml finds the root div in prose and fences, and refuses non-answers', () => {
  const root = '<div id="shot-root" style="width:10px"><h1 id="t" style="color:red">Hi</h1></div>';
  expect(extractHtml('```html\n' + root + '\n```')).toBe(root); expect(extractHtml('Here you go:\n' + root + '\nHope it helps')).toBe(root);
  expect(extractHtml('<div id="x"><script>alert(1)</script>ok</div>')).toBe('<div id="x">ok</div>');
  for (const nothing of ['', '   ', 'I cannot see an image.', '<p>not a div</p>', '<div id="a"></div', '</div><div>', '<script>alert(1)</script>']) expect(extractHtml(nothing), nothing).toBeNull();
});
const sender = (events: SayEvent[], seen?: { images?: unknown; system?: string }): SayTransport => (system, _r, on, images) => { if (seen) { seen.images = images; seen.system = system; } setTimeout(() => events.forEach(on), 0); };
const shot = { image: { mediaType: 'image/png' as const, data: 'iVBORw0KGgoAAAANSUhEUg==' }, size: { w: 1280, h: 800 } };
test('rebuild: collects streamed HTML, sends the image, and the result goes through the capture pipeline', async () => {
  const seen: { images?: unknown; system?: string } = {}; const reply = '<div id="shot-root" style="width:1280px;height:800px;background:#101820"><h1 id="title" style="color:#7cf0d0" onclick="x()">Hello</h1><script>x()</script></div>';
  const r = await rebuildScreenshot(sender([{ kind: 'delta', text: reply.slice(0, 40) }, { kind: 'delta', text: reply.slice(40) }, { kind: 'done' }], seen), shot); expect(seen.images).toEqual([shot.image]); expect(seen.system).toContain('1280px'); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.html).not.toContain('onclick'); expect(r.html).not.toContain('<script');
  const f = capturedFrame([], r.html, 'login-screen', { w: 1280, h: 800 }); expect(f.root).toBe('page'); expect(f.w).toBe(1280); expect(f.html).toContain('id="shot-root"'); expect(f.html).toContain('id="title"'); expect(f.html).toMatch(/<div id="page"[^>]*width:1280px;height:800px/); expect(captureToFrame(r.html).html).not.toContain('onclick');
});
test('rebuild reports helper errors, empty answers, prose and timeouts instead of swallowing them', async () => {
  expect(await rebuildScreenshot(sender([{ kind: 'error', text: 'usage limit reached' }]), shot)).toEqual({ ok: false, error: 'Claude could not rebuild it: usage limit reached' });
  expect(await rebuildScreenshot(sender([{ kind: 'done' }]), shot)).toEqual({ ok: false, error: 'Claude returned nothing usable.' });
  const prose = await rebuildScreenshot(sender([{ kind: 'delta', text: 'Sorry, I cannot rebuild that.' }, { kind: 'done' }]), shot); expect(prose.ok).toBe(false); if (!prose.ok) expect(prose.error).toContain('Sorry, I cannot');
  const slow = await rebuildScreenshot(() => {}, shot, { timeoutMs: 20 }); expect(slow).toEqual({ ok: false, error: 'Claude took too long to rebuild the screenshot.' });
  const ac = new AbortController(); const p = rebuildScreenshot(() => {}, shot, { signal: ac.signal }); ac.abort(); expect(await p).toEqual({ ok: false, error: 'cancelled' });
});
test('the e2e fixture reply (prose, fence, onclick, script, javascript: link, external url) comes out clean and editable', async () => {
  const { readFileSync } = await import('node:fs'); const reply = readFileSync(new URL('../../../tools/fixtures/screenshot-reply.html', import.meta.url), 'utf8'); const html = extractHtml(reply)!;
  expect(html).toMatch(/^<div id="shot-root"/); for (const bad of [/<script/i, /onclick/i, /javascript:/i, /evil\.test/i, /```/, /Here is/]) expect(html).not.toMatch(bad);
  for (const id of ['shot-title', 'shot-sub', 'shot-card', 'shot-link']) expect(html).toContain(`id="${id}"`);
});
