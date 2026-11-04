// Gate 3 evidence with the REAL local Claude Code (uses subscription: 3 x Spark of 12): Spark x12 on a tvdash frame and on the real research-radar and auto-label pages (captured from their builds),
// recording first paint, time to all takes, takes that changed, tokens and the lowest free memory seen while the sessions ran. node e2e/real-gate3.mjs
// Needs ../research-radar/extension/dist and ../auto-label/web/dist built. Screenshots of each wall go to e2e/gate3-<name>.png (git-ignored).
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const hobby = path.resolve(root, '..'); const procs = []; const N = Number(process.env.SPARK_N ?? 12);
const waitHttp = async (url) => { for (let i = 0; i < 80; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 250)); } throw new Error(`timeout ${url}`); };
const serve = (dir, port) => { procs.push(spawn('python3', ['-m', 'http.server', String(port), '--directory', dir], { stdio: 'ignore' })); };
const log = (m) => console.error(`[${new Date().toISOString().slice(11, 19)}] ${m}`); const out = { n: N, runs: [] };
setTimeout(() => { console.error('TIMEOUT'); procs.forEach((x) => x.kill()); process.exit(2); }, 900000);
try {
  serve(`${hobby}/research-radar/extension/dist`, 8913); serve(`${hobby}/auto-label/web/dist`, 8912);
  procs.push(spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, stdio: 'ignore' })); await waitHttp('http://localhost:5173/'); await waitHttp('http://localhost:8913/radar.html'); await waitHttp('http://localhost:8912/');
  procs.push(spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...process.env, SWIFT_DEV: '1', SWIFT_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sc-gate3-')) }, stdio: 'ignore' })); await new Promise((r) => setTimeout(r, 1000));
  const b = await chromium.launch({ headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await p.goto('http://localhost:5173/');
  await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]')?.textContent ?? ''), null, { timeout: 15000 }); await p.waitForTimeout(500);
  const capture = async (url) => { await p.getByTestId('project-button').click(); await p.waitForSelector('[data-testid=import]'); await p.getByTestId('capture-url').fill(url); await p.getByTestId('capture-go').click(); await p.waitForFunction(() => /Added|cannot|only|timed/.test(document.querySelector('[data-testid=capture-status]').textContent), null, { timeout: 40000 }); const st = (await p.textContent('[data-testid=capture-status]')).trim(); await p.keyboard.press('Escape'); await p.waitForTimeout(400); return st; };
  out.capture = [await capture('http://localhost:8913/radar.html'), await capture('http://localhost:8912/')]; log(`captured: ${out.capture.join(' | ')}`);
  const memMin = { gb: 99 }; const poll = setInterval(async () => { try { const t = await p.textContent('[data-testid=pool]', { timeout: 500 }); const m = /([\d.]+) GB free/.exec(t ?? ''); if (m) memMin.gb = Math.min(memMin.gb, Number(m[1])); } catch {} }, 700);
  const select = async (frameId) => { await p.evaluate((f) => window.__swift.fitTo([f]), frameId); await p.waitForTimeout(500); const c = await p.evaluate(() => { const r = document.querySelector('[data-testid=canvas]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await p.mouse.click(c.x, c.y); await p.waitForSelector('[data-testid=sel]', { timeout: 5000 }); };
  for (const [name, frame] of [['tvdash', 'tv'], ['research-radar', 'cap-1'], ['auto-label', 'cap-2']]) {
    await select(frame); log(`${name}: Spark x${N}`); memMin.gb = 99; const t0 = Date.now(); await p.getByTestId('frame-menu').click(); await p.getByTestId('spark-12').click();
    await p.waitForFunction(() => /takes/.test(document.querySelector('[data-testid=spark-status]')?.textContent ?? ''), null, { timeout: 300000 }); const wall = Date.now() - t0; const status = (await p.textContent('[data-testid=spark-status]')).trim();
    const takes = await p.evaluate((f) => window.__swift.frames.filter((x) => x.startsWith(f + '-t')).length, frame); await p.evaluate(() => window.__swift.fitAll()); await p.waitForTimeout(500); await p.screenshot({ path: `${root}/e2e/gate3-${name}.png` });
    out.runs.push({ name, status, wallMs: wall, takes, minFreeGb: memMin.gb === 99 ? null : memMin.gb }); log(status);
    await p.getByRole('button', { name: /Discard takes/ }).click(); await p.waitForTimeout(800);
  }
  clearInterval(poll); console.log(JSON.stringify(out, null, 1)); await b.close();
} catch (e) { console.error(e); out.error = String(e); console.log(JSON.stringify(out, null, 1)); } finally { procs.forEach((x) => x.kill()); process.exit(0); }
