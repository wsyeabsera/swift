// Manual check against the REAL local Claude Code on a frame too big for the full markup (outline path, #1734). node e2e/real-big-say.mjs "make item 70 red"
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const request = process.argv[2] ?? 'make item 70 red'; const procs = [];
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout'); };
try {
  procs.push(spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, stdio: 'ignore' })); await waitHttp('http://localhost:5173/');
  procs.push(spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...process.env, SWIFT_DEV: '1', SWIFT_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sc-real-')) }, stdio: 'ignore' })); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await p.goto('http://localhost:5173/');
  await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]').textContent), null, { timeout: 10000 }); await p.waitForTimeout(500);
  await p.evaluate(async () => { const rows = Array.from({ length: 90 }, (_, i) => `<div id="item${i}" style="position:absolute;left:40px;top:${40 + i * 36}px;font-size:22px;letter-spacing:0.02em;color:#f5f5f7;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,0.06)">Item number ${i}</div>`).join(''); await window.__swift.load('tv', `<div id="tv" style="position:relative;width:1920px;height:1080px;overflow:hidden;font-family:system-ui;background:#0b1a3a">${rows}</div>`); });
  const size = await p.evaluate(async () => (await window.__swift.snapshot('tv')).length);
  const g = (el, prop) => p.evaluate(([e, q]) => window.__swift.get('tv', e, q), [el, prop]);
  const before = { item70: await g('item70', 'color'), item3: await g('item3', 'color'), size };
  await p.getByTestId('say-input').focus(); await p.waitForTimeout(2500); // a spare is ready (prewarmed on connect and on focus)
  const t0 = Date.now(); await p.getByTestId('say-input').fill(request); await p.getByTestId('say-button').click();
  await p.waitForFunction(() => /applied|failed|asks/.test(document.querySelector('[data-testid=say-status]').textContent), null, { timeout: 60000 }); const wall = Date.now() - t0;
  await p.waitForTimeout(500); const after = { item70: await g('item70', 'color'), item3: await g('item3', 'color') };
  console.log(JSON.stringify({ request, before, after, status: (await p.textContent('[data-testid=say-status]')).trim(), wallMs: wall }, null, 1));
  await p.evaluate(() => window.__swift.fitAll()); await p.screenshot({ path: `${root}/e2e/shot-real-big-say.png` }); await b.close();
} finally { procs.forEach((x) => x.kill()); process.exit(0); }
