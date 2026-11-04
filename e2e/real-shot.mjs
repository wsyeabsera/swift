// Manual proof against the REAL local Claude Code (uses a little subscription): screenshot a built app, import the PNG through Import -> From a screenshot, save the result.
//   node e2e/real-shot.mjs [dist-dir]   (default ../auto-label/web/dist)   writes e2e/shot-real-screenshot-source.png and e2e/shot-real-screenshot-import.png
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
import { TEST_URL, viteEnv, helperEnv } from './env.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const dist = path.resolve(process.argv[2] ?? `${root}/../auto-label/web/dist`); const procs = []; const out = {};
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout ' + url); };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const srv = http.createServer((q, r) => { let f = path.join(dist, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(dist)) { r.writeHead(403).end(); return; } if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html'); r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8921, '127.0.0.1');
try {
  const b = await chromium.launch({ headless: true }); const src = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); await src.goto('http://127.0.0.1:8921/'); await src.waitForTimeout(2500);
  const srcPng = `${root}/e2e/shot-real-screenshot-source.png`; await src.screenshot({ path: srcPng }); out.sourceBytes = fs.statSync(srcPng).size;
  procs.push(spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, env: viteEnv, stdio: 'ignore' })); await waitHttp(TEST_URL);
  procs.push(spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...helperEnv, SWIFT_DEV: '1', SWIFT_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sc-real-shot-')) }, stdio: 'ignore' })); await new Promise(r => setTimeout(r, 800));
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage(); await p.goto(TEST_URL);
  await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]').textContent), null, { timeout: 10000 }); await p.waitForTimeout(800);
  await p.getByTestId('project-button').click(); await p.waitForSelector('[data-testid=import]'); const n0 = await p.evaluate(() => window.__swift.frames.length);
  const t0 = Date.now(); await p.getByTestId('shot-input').setInputFiles(srcPng);
  await p.waitForFunction(() => /^Added|Claude|image|PNG|MB/.test(document.querySelector('[data-testid=shot-status]').textContent) && !/rebuilding/i.test(document.querySelector('[data-testid=shot-status]').textContent), null, { timeout: 280000 }); out.wallMs = Date.now() - t0; out.status = (await p.textContent('[data-testid=shot-status]')).trim();
  if (/^Added/.test(out.status)) { await p.keyboard.press('Escape'); await p.waitForTimeout(500); const fid = await p.evaluate(() => window.__swift.frames[window.__swift.frames.length - 1]); out.frame = fid; out.nodes = (await p.evaluate((f) => window.__swift.tree(f), fid)).length; await p.evaluate((f) => window.__swift.fitTo([f]), fid); await p.waitForTimeout(1200); await p.screenshot({ path: `${root}/e2e/shot-real-screenshot-import.png` }); }
  console.log(JSON.stringify(out, null, 1)); await b.close();
} finally { procs.forEach((x) => x.kill()); srv.close(); process.exit(0); }
