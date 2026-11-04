// Manual check: one Say against the REAL local Claude Code, then Frame ▾ → Pulse must show the Claude token usage (one Haiku request; uses a little subscription). node e2e/real-usage.mjs
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
import { TEST_URL, viteEnv, helperEnv } from './env.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const request = process.argv[2] ?? 'make the clock bigger'; const procs = [];
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout'); };
try {
  procs.push(spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, env: viteEnv, stdio: 'ignore' })); await waitHttp(TEST_URL);
  procs.push(spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...helperEnv, SWIFT_DEV: '1', SWIFT_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sc-real-')) }, stdio: 'ignore' })); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await p.goto(TEST_URL);
  await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]').textContent), null, { timeout: 10000 }); await p.waitForTimeout(500);
  await p.getByTestId('say-input').focus(); await p.waitForTimeout(Number(process.env.WARM_MS ?? 2500)); // a spare is ready (prewarmed on connect and on focus)
  await p.evaluate(() => window.__swift.fitAll()); const t0 = Date.now(); await p.evaluate(() => { window.__t0 = performance.now(); window.__first = null; new MutationObserver(() => { if (window.__first === null && document.querySelectorAll('[data-testid=frame-busy]').length > 0) window.__busyAt = performance.now(); }).observe(document.body, { childList: true, subtree: true }); });
  await p.getByTestId('say-input').fill('make the clock bigger'); await p.getByTestId('say-button').click();
  await p.waitForFunction(() => /applied|failed/.test(document.querySelector('[data-testid=say-status]')?.textContent ?? ''), null, { timeout: 90000 });
  const status = (await p.textContent('[data-testid=say-status]')).trim(); await p.getByTestId('frame-menu').click(); await p.waitForSelector('[data-testid=usage]');
  console.log(JSON.stringify({ status, usage: (await p.textContent('[data-testid=usage]')).trim() }, null, 1));
  await p.evaluate(() => window.__swift.fitAll()); await p.screenshot({ path: `${root}/e2e/shot-real-usage.png` }); await b.close();
} finally { procs.forEach((x) => x.kill()); process.exit(0); }
