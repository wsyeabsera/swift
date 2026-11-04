// Manual check against the REAL local Claude Code (uses a little of your subscription). node e2e/real-say.mjs "make the clock bigger"
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
import { TEST_URL, viteEnv, helperEnv } from './env.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const request = process.argv[2] ?? 'make the clock bigger'; const procs = [];
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout'); };
try {
  procs.push(spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, env: viteEnv, stdio: 'ignore' })); await waitHttp(TEST_URL);
  procs.push(spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...helperEnv, SWIFT_DEV: '1', SWIFT_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sc-real-')) }, stdio: 'ignore' })); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await p.goto(TEST_URL);
  await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]').textContent), null, { timeout: 10000 }); await p.waitForTimeout(500);
  const g = (el, prop) => p.evaluate(([e, q]) => window.__swift.get('tv', e, q), [el, prop]);
  const before = { clock: await g('clock', 'font-size'), date: await g('date', 'opacity') };
  await p.getByTestId('say-input').focus(); await p.waitForTimeout(2500); // a spare is ready (prewarmed on connect and on focus)
  const t0 = Date.now(); await p.getByTestId('say-input').fill(request); await p.getByTestId('say-button').click();
  await p.waitForFunction(() => /applied|failed|asks/.test(document.querySelector('[data-testid=say-status]').textContent), null, { timeout: 60000 }); const wall = Date.now() - t0;
  await p.waitForTimeout(500); const after = { clock: await g('clock', 'font-size'), date: await g('date', 'opacity') };
  console.log(JSON.stringify({ request, before, after, status: (await p.textContent('[data-testid=say-status]')).trim(), wallMs: wall }, null, 1));
  await p.evaluate(() => window.__swift.fitAll()); await p.screenshot({ path: `${root}/e2e/shot-real-say.png` }); await b.close();
} finally { procs.forEach((x) => x.kill()); process.exit(0); }
