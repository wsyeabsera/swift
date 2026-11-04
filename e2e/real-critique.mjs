// Manual check against the REAL local Claude Code (uses a little of your subscription): local pre-pass + Claude critique of the tvdash TV frame. node e2e/real-critique.mjs
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const procs = [];
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout'); };
try {
  procs.push(spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, stdio: 'ignore' })); await waitHttp('http://localhost:5173/');
  procs.push(spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...process.env, SWIFT_DEV: '1', SWIFT_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sc-real-')) }, stdio: 'ignore' })); await new Promise(r => setTimeout(r, 1500));
  const b = await chromium.launch({ headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await p.goto('http://localhost:5173/');
  await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]').textContent), null, { timeout: 10000 }); await p.waitForTimeout(800);
  await p.getByTestId('frame-menu').click(); const t0 = Date.now(); await p.getByTestId('critique').click();
  await p.waitForFunction(() => /from Claude|failed|not ready/.test(document.querySelector('[data-testid=findings]').previousElementSibling.previousElementSibling.textContent), null, { timeout: 120000 });
  const note = await p.evaluate(() => document.querySelector('[data-testid=findings]').previousElementSibling.previousElementSibling.textContent); const rows = await p.$$eval('[data-testid=finding]', (e) => e.map((x) => ({ kind: x.getAttribute('data-kind'), text: x.textContent })));
  console.log(JSON.stringify({ note, wallMs: Date.now() - t0, rows }, null, 1)); await b.close();
} finally { procs.forEach((x) => x.kill()); process.exit(0); }
