// Manual: Spark x4 against the REAL local Claude Code (4 parallel requests, a little subscription). node e2e/real-spark.mjs
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const procs = [];
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout'); };
try {
  procs.push(spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, stdio: 'ignore' })); await waitHttp('http://localhost:5173/');
  procs.push(spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...process.env, SWIFT_DEV: '1' }, stdio: 'ignore' })); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ headless: true }); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); await p.goto('http://localhost:5173/');
  await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]').textContent), null, { timeout: 10000 }); await p.waitForTimeout(2000);
  const t0 = Date.now(); await p.getByTestId('spark-button').click();
  await p.waitForFunction(() => /takes/.test(document.querySelector('[data-testid=spark-status]')?.textContent ?? ''), null, { timeout: 90000 }); const wall = Date.now() - t0; await p.waitForTimeout(800);
  console.log(JSON.stringify({ status: (await p.textContent('[data-testid=spark-status]')).trim(), wallMs: wall })); await p.screenshot({ path: `${root}/e2e/shot-real-spark.png` }); await b.close();
} finally { procs.forEach((x) => x.kill()); process.exit(0); }
