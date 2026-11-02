// End-to-end smoke: helper + dev server + the app as a plain web page AND as the real unpacked extension. Also: a wrong origin must be refused.
// node e2e/smoke.mjs   (needs: cargo build, npm run build, Playwright's Chromium)
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const out = {}; const procs = [];
const kill = () => procs.forEach(p => p.kill());
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout ' + url); };
try {
  const vite = spawn('npx', ['vite', '--config', 'vite.config.ts'], { cwd: root, stdio: 'ignore' }); procs.push(vite); await waitHttp('http://localhost:5173/');
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'sc-e2e-')), { headless: false, args: [`--disable-extensions-except=${root}/extension`, `--load-extension=${root}/extension`] });
  let sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker', { timeout: 15000 }); const id = new URL(sw.url()).host; out.extensionId = id;
  const helper = spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...process.env, SWIFT_DEV: '1', SWIFT_ALLOWED_ORIGINS: `chrome-extension://${id}` }, stdio: 'ignore' }); procs.push(helper); await new Promise(r => setTimeout(r, 800));
  const status = async (page) => { await page.waitForSelector('[data-testid=helper-status]'); await page.waitForFunction(() => /connected|claude|offline/.test(document.querySelector('[data-testid=helper-status]').textContent), null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(600); return (await page.textContent('[data-testid=helper-status]')).trim(); };
  const web = await ctx.newPage(); await web.goto('http://localhost:5173/'); out.web = await status(web); await web.screenshot({ path: `${root}/e2e/shot-web.png` });
  // canvas: 20 sandboxed frames, pan/zoom, freeze offscreen, Tier-0 edit and hit-test through the bridge
  await web.waitForFunction(() => window.__swift && window.__swift.frames.length === 20); const cv = {};
  cv.frames = await web.evaluate(() => document.querySelectorAll('.fr iframe').length); cv.sandbox = await web.evaluate(() => [...document.querySelectorAll('.fr iframe')].every((f) => f.getAttribute('sandbox') === 'allow-scripts'));
  cv.visibleAtFit = await web.evaluate(() => window.__swift.visibleCount());
  cv.zoomed = await web.evaluate(() => { const h = document.querySelector('[data-testid=canvas]'); const s0 = window.__swift.view().s; h.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, clientX: 600, clientY: 400, bubbles: true, cancelable: true })); return window.__swift.view().s > s0; });
  cv.panned = await web.evaluate(() => { const h = document.querySelector('[data-testid=canvas]'); const x0 = window.__swift.view().x; h.dispatchEvent(new WheelEvent('wheel', { deltaX: 100, deltaY: 0, bubbles: true, cancelable: true })); return window.__swift.view().x < x0; });
  cv.frozenFar = await web.evaluate(async () => { window.__swift.setView({ x: -30000, y: -30000, s: 1 }); const n = window.__swift.visibleCount(); await new Promise((r) => setTimeout(r, 150)); const hidden = [...document.querySelectorAll('.fr')].filter((f) => f.style.display === 'none').length; window.__swift.fitAll(); return { visible: n, hidden }; });
  await web.waitForTimeout(300);
  cv.edit = await web.evaluate(() => window.__swift.edit('tv', 'clock', 'font-size', '260px')); cv.editRead = await web.evaluate(() => window.__swift.get('tv', 'clock', 'font-size'));
  cv.editMissing = await web.evaluate(() => window.__swift.edit('tv', 'nope', 'color', 'red')); cv.hit = await web.evaluate(() => window.__swift.hit('tv', 200, 200));
  cv.parentCannotReadFrame = await web.evaluate(() => { try { return document.querySelector('.fr iframe').contentDocument === null; } catch { return true; } });
  await web.screenshot({ path: `${root}/e2e/shot-canvas.png` }); out.canvas = cv;
  const ext = await ctx.newPage(); await ext.goto(`chrome-extension://${id}/app/index.html`); out.extension = await status(ext);
  await ext.waitForFunction(() => window.__swift && window.__swift.frames.length === 20); out.extEdit = await ext.evaluate(() => window.__swift.edit('tv', 'clock', 'font-size', '260px')); out.extRead = await ext.evaluate(() => window.__swift.get('tv', 'clock', 'font-size'));
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' }; const srv = http.createServer((q, r) => { const f = path.join(root, 'extension/app', q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; r.end(); } else { r.setHeader('content-type', mime[path.extname(f)] ?? 'application/octet-stream'); r.end(d); } }); }).listen(5199, '127.0.0.1'); procs.push({ kill: () => srv.close() });
  const bad = await ctx.newPage(); await bad.goto('http://127.0.0.1:5199/'); out.wrongOrigin = await status(bad);
  const c = out.canvas; const canvasOk = c.frames === 20 && c.sandbox && c.zoomed && c.panned && c.frozenFar.visible === 0 && c.frozenFar.hidden === 20 && c.edit.ok && c.edit.ms < 50 && c.editRead === '260px' && c.editMissing.ok === false && c.hit === 'clock' && c.parentCannotReadFrame;
  const extOk = out.extEdit.ok && out.extRead === '260px';
  const ok = canvasOk && extOk && out.web.includes('claude') && out.extension.includes('claude') && !out.wrongOrigin.includes('claude'); out.pass = ok; console.log(JSON.stringify(out, null, 1)); await ctx.close(); kill(); process.exit(ok ? 0 : 1);
} catch (e) { console.error(e); kill(); process.exit(1); }
