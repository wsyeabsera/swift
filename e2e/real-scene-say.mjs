// Manual check against the REAL local Claude Code (uses a little of your subscription): Say in the 3D lens. node e2e/real-scene-say.mjs "make the box red"
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
import { TEST_URL, viteEnv, helperEnv } from './env.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const request = process.argv[2] ?? 'make the box red and a bit bigger'; const procs = [];
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 250)); } throw new Error('timeout'); };
try {
  procs.push(spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, env: viteEnv, stdio: 'ignore' })); await waitHttp(TEST_URL);
  procs.push(spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...helperEnv, SWIFT_DEV: '1', SWIFT_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sc-real3d-')) }, stdio: 'ignore' })); await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch({ headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await p.goto(TEST_URL);
  await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]').textContent), null, { timeout: 10000 }); await p.waitForTimeout(500);
  await p.getByRole('button', { name: '3D', exact: true }).click(); await p.waitForSelector('[data-testid=studio-say]'); await p.getByTestId('outline-obj').first().click();
  const read = () => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('swift-canvas.scene3d')); return k ? JSON.parse(localStorage.getItem(k)).objects.find((o) => o.id === 'box-1') : null; });
  const before = await read(); const t0 = Date.now(); await p.getByTestId('studio-say-input').fill(request); await p.getByTestId('studio-say-go').click();
  await p.waitForFunction(() => /Updated the scene|Not applied|changed nothing/.test(document.querySelector('[data-testid=say-status]')?.textContent ?? ''), null, { timeout: 90000 }); const wall = Date.now() - t0; await p.waitForTimeout(600);
  console.log(JSON.stringify({ request, before, after: await read(), status: (await p.textContent('[data-testid=say-status]')).trim(), wallMs: wall }, null, 1)); await p.screenshot({ path: `${root}/e2e/shot-real-scene-say.png` }); await b.close();
} finally { procs.forEach((x) => x.kill()); process.exit(0); }
