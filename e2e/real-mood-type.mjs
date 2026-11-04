// Manual check against the REAL local Claude Code (uses a little subscription): add a reference image to the moodboard and let Claude describe its typography. node e2e/real-mood-type.mjs <image.png>
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const image = process.argv[2]; const procs = [];
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout'); };
try {
  procs.push(spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, stdio: 'ignore' })); await waitHttp('http://localhost:5173/');
  procs.push(spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...process.env, SWIFT_DEV: '1', SWIFT_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sc-real-')) }, stdio: 'ignore' })); await new Promise(r => setTimeout(r, 1500));
  const b = await chromium.launch({ headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await p.goto('http://localhost:5173/');
  await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]').textContent), null, { timeout: 10000 }); await p.waitForTimeout(800);
  await p.getByTestId('frame-menu').click(); await p.getByTestId('mood-input').setInputFiles(image); await p.waitForSelector('[data-testid=mood-ref]', { timeout: 5000 }); const t0 = Date.now(); await p.getByTestId('mood-type').click();
  await p.waitForSelector('[data-testid=mood-note]', { timeout: 90000 }); console.log(JSON.stringify({ note: await p.textContent('[data-testid=mood-note]'), wallMs: Date.now() - t0 }, null, 1)); await b.close();
} finally { procs.forEach((x) => x.kill()); process.exit(0); }
