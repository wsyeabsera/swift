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
  const ext = await ctx.newPage(); await ext.goto(`chrome-extension://${id}/app/index.html`); out.extension = await status(ext);
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' }; const srv = http.createServer((q, r) => { const f = path.join(root, 'extension/app', q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; r.end(); } else { r.setHeader('content-type', mime[path.extname(f)] ?? 'application/octet-stream'); r.end(d); } }); }).listen(5199, '127.0.0.1'); procs.push({ kill: () => srv.close() });
  const bad = await ctx.newPage(); await bad.goto('http://127.0.0.1:5199/'); out.wrongOrigin = await status(bad);
  const ok = out.web.includes('claude') && out.extension.includes('claude') && !out.wrongOrigin.includes('claude'); out.pass = ok; console.log(JSON.stringify(out, null, 1)); await ctx.close(); kill(); process.exit(ok ? 0 : 1);
} catch (e) { console.error(e); kill(); process.exit(1); }
