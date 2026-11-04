// Gate 1 / Gate 2 evidence on REAL example UIs: tvdash + research-radar + auto-label open together (the last two captured from their built apps with real Chrome).
// node e2e/real-projects.mjs   (needs ../research-radar/extension/dist and ../auto-label/web/dist built; no Claude calls; plug in the Mac for the frame-time number)
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
import { TEST_URL, viteEnv, helperEnv } from './env.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const hobby = path.resolve(root, '..'); const procs = []; const out = { checks: {} };
const waitHttp = async (url) => { for (let i = 0; i < 80; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 250)); } throw new Error(`timeout ${url}`); };
const serve = (dir, port) => { procs.push(spawn('python3', ['-m', 'http.server', String(port), '--directory', dir], { stdio: 'ignore' })); };
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
setTimeout(() => { console.error('TIMEOUT'); procs.forEach((x) => x.kill()); process.exit(2); }, 240000); const log = (m) => console.error(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
try {
  serve(`${hobby}/research-radar/extension/dist`, 8913); serve(`${hobby}/auto-label/web/dist`, 8912);
  procs.push(spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, env: viteEnv, stdio: 'ignore' })); await waitHttp(TEST_URL); await waitHttp('http://localhost:8913/radar.html');
  procs.push(spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...helperEnv, SWIFT_DEV: '1', SWIFT_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sc-real-')) }, stdio: 'ignore' })); await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch({ headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await p.goto(TEST_URL);
  await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]')?.textContent ?? ''), null, { timeout: 15000 }); await p.waitForTimeout(500);
  const capture = async (url, use = false) => { await p.getByTestId('project-button').click(); await p.waitForSelector('[data-testid=import]'); await p.getByTestId('capture-url').fill(url); await p.getByTestId('capture-go').click(); await p.waitForFunction(() => /Added|cannot|only|timed/.test(document.querySelector('[data-testid=capture-status]').textContent), null, { timeout: 40000 }); const st = (await p.textContent('[data-testid=capture-status]')).trim(); if (await p.getByTestId('capture-use').count()) { out.kitTokens = (out.kitTokens ?? []).concat(await p.getByTestId('capture-use').textContent()); if (use) { await p.getByTestId('capture-use').click(); await p.waitForTimeout(300); } } await p.keyboard.press('Escape'); await p.waitForTimeout(400); return st; };
  log('captured app ready'); out.capture = [await capture('http://localhost:8913/radar.html', true)]; log('radar'); 
  // #1680: a REAL radar element goes to the shared library (origin kit = radar's tokens), then is inserted into the auto-label frame (target kit = auto-label's tokens): re-themed in one step
  { await p.evaluate(() => window.__swift.fitTo(['cap-1'])); await p.waitForTimeout(400); let saved = false;
    for (const [fx, fy] of [[0.3, 0.3], [0.5, 0.25], [0.5, 0.4], [0.2, 0.15]]) { const pt = await p.evaluate(([a, c]) => { const box = [...document.querySelectorAll('.fr')].find((e) => e.querySelector('iframe')?.title?.includes('8913'))?.getBoundingClientRect(); return box ? { x: box.x + box.width * a, y: box.y + box.height * c } : null; }, [fx, fy]); if (!pt) break;
      await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(300); const id = (await p.textContent('[data-testid=inspector-id]'))?.trim(); if (id === 'page' || id === 'nothing selected') continue;
      await p.getByTestId('frame-menu').click(); await p.getByTestId('lib-save').click(); await p.waitForTimeout(300); await p.keyboard.press('Escape'); saved = true; out.libSaved = id; break; }
    out.capture.push(await capture('http://localhost:8912/', true)); log('auto-label');
    if (saved) { await p.evaluate(() => window.__swift.fitTo(['cap-2'])); await p.waitForTimeout(400); const pt = await p.evaluate(() => { const box = [...document.querySelectorAll('.fr')].find((e) => e.querySelector('iframe')?.title?.includes('8912'))?.getBoundingClientRect(); return box ? { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 } : null; }); await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(300);
      await p.getByTestId('frame-menu').click(); const t0 = Date.now(); await p.getByTestId('lib-item').first().click(); await p.waitForTimeout(600); out.libInsert = { status: (await p.textContent('[data-testid=say-status]'))?.trim(), wallMs: Date.now() - t0 }; await p.keyboard.press('Escape'); } }
 await p.waitForTimeout(1500);
  out.frames = await p.evaluate(() => window.__swift.frames);
  log('measuring pan');
  // Gate 1: pan/zoom frame gap with all three example UIs open (tvdash TV frames + radar + auto-label)
  await p.evaluate(() => window.__swift.fitAll()); await p.waitForTimeout(300);
  out.pan = await p.evaluate(async () => { const host = document.querySelector('[data-testid=canvas]'); const gaps = []; let last = performance.now(); let stop = false; const tick = (t) => { gaps.push(t - last); last = t; if (!stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    for (let i = 0; i < 180; i++) { const zoom = i % 3 === 2; host.dispatchEvent(new WheelEvent('wheel', { deltaX: zoom ? 0 : 25, deltaY: zoom ? (i % 6 === 2 ? -30 : 30) : 12, ctrlKey: zoom, clientX: 640, clientY: 360, bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 11)); }
    stop = true; await new Promise((r) => setTimeout(r, 50)); gaps.shift(); gaps.sort((a, b) => a - b); return { frames: gaps.length, p50: +gaps[Math.floor(gaps.length / 2)].toFixed(1), p95: +gaps[Math.floor(gaps.length * 0.95)].toFixed(1), max: +gaps.at(-1).toFixed(1) }; });
  log('pan done'); // Tier 0: edits on real frames (every captured frame, an element with an id)
  out.tier0 = {}; for (const id of out.frames.filter((f) => f.startsWith('cap-'))) { const ids = await p.evaluate(async (f) => (await window.__swift.tree(f)).map((n) => n.id), id); const el = ids[Math.min(3, ids.length - 1)];
    const t = await p.evaluate(async ([f, e]) => { const r = []; for (let i = 0; i < 30; i++) r.push((await window.__swift.edit(f, e, 'color', `hsl(${i * 12} 80% 60%)`)).ms); return r; }, [id, el]); out.tier0[id] = { nodes: ids.length, p95: +pct(t, 0.95).toFixed(2), max: +Math.max(...t).toFixed(2) }; }
  log('tier0 done'); // select + move + undo on a captured frame (#1675 Done-when)
  { const f = 'cap-1'; await p.evaluate((x) => window.__swift.fitTo([x]), f); await p.waitForTimeout(400); let done = null;
    for (const [fx, fy] of [[0.5, 0.2], [0.3, 0.3], [0.5, 0.4], [0.7, 0.25], [0.2, 0.15], [0.5, 0.1]]) {
      const pt = await p.evaluate(([x, a, c]) => { const v = window.__swift.view(); const fr = window.__swift.rect ? null : null; const host = document.querySelector('[data-testid=canvas]').getBoundingClientRect(); const els = [...document.querySelectorAll('.fr')]; const box = els.find((e) => e.querySelector('iframe')?.title?.includes('localhost:8913'))?.getBoundingClientRect(); return box ? { x: box.x + box.width * a, y: box.y + box.height * c } : null; }, [f, fx, fy]); if (!pt) break;
      await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(300); const id = (await p.textContent('[data-testid=inspector-id]'))?.trim(); const sel = await p.$('[data-testid=sel]'); if (!sel || id === 'page' || id === 'nothing selected') continue; const bb = await sel.boundingBox(); if (!bb || bb.width < 20) continue;
      const g = () => p.evaluate(([x, e]) => window.__swift.get(x, e, 'translate'), [f, id]); const before = await g(); const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2; await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 25, cy + 15, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(400);
      const moved = await g(); await p.getByTestId('undo').click(); await p.waitForTimeout(400); const back = await g(); done = { el: id, before, moved, back, ok: moved !== before && back === before }; if (done.ok) break; }
    out.moveUndo = done; }
  fs.writeFileSync(`${root}/e2e/real-projects-report.json`, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1)); await p.screenshot({ path: `${root}/e2e/shot-real-projects.png` }); await b.close();
} catch (e) { console.error('FAILED', e.message); process.exitCode = 1; } finally { procs.forEach((x) => x.kill()); process.exit(process.exitCode ?? 0); }
