// End-to-end smoke: helper + dev server + the app as a plain web page AND as the real unpacked extension. Also: a wrong origin must be refused.
// node e2e/smoke.mjs   (needs: cargo build, npm run build, Playwright's Chromium)
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import net from 'node:net';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const out = {}; const procs = [];
const kill = () => procs.forEach(p => p.kill());
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout ' + url); };
const inUse = (port) => new Promise((res) => { const c = net.connect(port, '127.0.0.1'); c.on('connect', () => { c.destroy(); res(true); }); c.on('error', () => res(false)); });
for (const port of [7431]) if (await inUse(port)) { console.error(`port ${port} is already in use (a stale helper from an earlier run?): stop it first, e.g. pkill -f target/debug/swift-canvas-helper`); process.exit(2); }
try {
  const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, stdio: 'ignore' }); procs.push(vite); await waitHttp('http://localhost:5173/');
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'sc-e2e-')), { headless: false, args: [`--disable-extensions-except=${root}/extension`, `--load-extension=${root}/extension`] });
  let sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker', { timeout: 15000 }); const id = new URL(sw.url()).host; out.extensionId = id;
  const helper = spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...process.env, SWIFT_DEV: '1', SWIFT_ALLOWED_ORIGINS: `chrome-extension://${id}`, SWIFT_PROJECT_ROOTS: `${root}`, SWIFT_CLAUDE_BIN: `${root}/tools/fake-claude.mjs`, FAKE_FIXTURE: `${root}/tools/fixtures/say-clock.json` }, stdio: 'ignore' }); procs.push(helper); await new Promise(r => setTimeout(r, 800));
  const status = async (page) => { await page.waitForSelector('[data-testid=helper-status]'); await page.waitForFunction(() => /connected|claude|offline/.test(document.querySelector('[data-testid=helper-status]').textContent), null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(600); return (await page.textContent('[data-testid=helper-status]')).trim(); };
  const web = await ctx.newPage(); await web.goto('http://localhost:5173/'); out.web = await status(web); await web.screenshot({ path: `${root}/e2e/shot-web.png` });
  // canvas: 20 sandboxed frames, pan/zoom, freeze offscreen, Tier-0 edit and hit-test through the bridge
  await web.waitForFunction(() => window.__swift && window.__swift.frames.length === 20); const cv = {};
  cv.frames = await web.evaluate(() => document.querySelectorAll('.fr iframe').length); cv.sandbox = await web.evaluate(() => [...document.querySelectorAll('.fr iframe')].every((f) => f.getAttribute('sandbox') === 'allow-scripts'));
  cv.visibleAtFit = await web.evaluate(() => window.__swift.visibleCount());
  cv.zoomed = await web.evaluate(() => { const h = document.querySelector('[data-testid=canvas]'); const s0 = window.__swift.view().s; h.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, clientX: 600, clientY: 400, bubbles: true, cancelable: true })); return window.__swift.view().s > s0; });
  cv.panned = await web.evaluate(() => { const h = document.querySelector('[data-testid=canvas]'); const x0 = window.__swift.view().x; h.dispatchEvent(new WheelEvent('wheel', { deltaX: 100, deltaY: 0, bubbles: true, cancelable: true })); return window.__swift.view().x < x0; });
  cv.frozenFar = await web.evaluate(async () => { window.__swift.setView({ x: -30000, y: -30000, s: 1 }); const n = window.__swift.visibleCount(); await new Promise((r) => setTimeout(r, 150)); const hidden = [...document.querySelectorAll('.fr')].filter((f) => f.style.display === 'none').length; window.__swift.fitAll(); return { visible: n, hidden }; });
  await web.waitForTimeout(300);
  cv.edit = await web.evaluate(() => window.__swift.edit('tv', 'clock', 'font-size', '260px')); cv.editRead = await web.evaluate(() => window.__swift.get('tv', 'clock', 'font-size'));
  cv.editMissing = await web.evaluate(() => window.__swift.edit('tv', 'nope', 'color', 'red')); cv.hit = await web.evaluate(() => window.__swift.hit('tv', 200, 200));
  cv.parentCannotReadFrame = await web.evaluate(() => { try { return document.querySelector('.fr iframe').contentDocument === null; } catch { return true; } });
  // select by clicking, layers + inspector, edit through the inspector, undo, pick a layer
  await web.evaluate(() => window.__swift.fitAll()); await web.waitForTimeout(200); const startFs = await web.evaluate(() => window.__swift.get('tv', 'clock', 'font-size'));
  const pt = await web.evaluate(() => { const v = window.__swift.view(); return { x: v.x + 190 * v.s, y: v.y + 186 * v.s }; }); await web.mouse.click(pt.x, pt.y);
  await web.waitForSelector('[data-testid=sel]', { timeout: 4000 }); cv.selected = (await web.textContent('[data-testid=inspector-id]'))?.trim();
  await web.waitForSelector('[data-testid=layers] .row', { timeout: 4000 }); cv.layers = await web.$$eval('[data-testid=layers] .row', (els) => els.map((e) => e.querySelector('.mono').textContent));
  const fsz = web.getByLabel('font-size'); await fsz.fill('300px'); await fsz.press('Enter'); await web.waitForTimeout(300); cv.inspectorEdit = await web.evaluate(() => window.__swift.get('tv', 'clock', 'font-size'));
  cv.tier0Label = (await web.textContent('[data-testid=tier0]'))?.trim(); await web.getByTestId('undo').click(); await web.waitForTimeout(300); cv.afterUndo = await web.evaluate(() => window.__swift.get('tv', 'clock', 'font-size')); cv.startFs = startFs;
  await web.getByRole('button', { name: /^date/ }).click(); await web.waitForTimeout(300); cv.pickedLayer = (await web.textContent('[data-testid=inspector-id]'))?.trim();
  // THE THIN SLICE: Say -> helper -> (fake) Claude Code -> streamed ops -> applied on the frame -> one-step undo
  await web.mouse.click(5, 400); await web.waitForTimeout(200); const before = await web.evaluate(() => window.__swift.get('tv', 'clock', 'font-size')); const beforeOp = await web.evaluate(() => window.__swift.get('tv', 'date', 'opacity'));
  await web.getByTestId('say-input').fill('make the clock bigger'); await web.getByTestId('say-button').click();
  await web.waitForFunction(() => /applied|failed/.test(document.querySelector('[data-testid=say-status]').textContent), null, { timeout: 8000 }); cv.sayStatus = (await web.textContent('[data-testid=say-status]'))?.trim();
  cv.sayApplied = { fontSize: await web.evaluate(() => window.__swift.get('tv', 'clock', 'font-size')), dateOpacity: await web.evaluate(() => window.__swift.get('tv', 'date', 'opacity')), token: (await web.evaluate(() => window.__swift.get('tv', 'tv', '--ac')))?.trim() };
  await web.getByTestId('undo').click(); await web.waitForTimeout(400); cv.sayUndone = { fontSize: await web.evaluate(() => window.__swift.get('tv', 'clock', 'font-size')), before, beforeOp, dateOpacity: await web.evaluate(() => window.__swift.get('tv', 'date', 'opacity')), status: (await web.textContent('[data-testid=say-status]'))?.trim() };
  await web.mouse.click(5, 400); await web.waitForTimeout(300); cv.cleared = (await web.textContent('[data-testid=inspector-id]'))?.trim();
  // Tier-0 budget (task #1676): 30 edits through the bridge, p95 under 16 ms
  const times = await web.evaluate(async () => { const t = []; for (let i = 0; i < 30; i++) { const r = await window.__swift.edit('tv', 'clock', 'color', `hsl(${i * 12} 80% 70%)`); t.push(r.ms); } return t; }); times.sort((a, b) => a - b); cv.tier0p95 = +times[Math.floor(times.length * 0.95)].toFixed(2); cv.tier0max = +times.at(-1).toFixed(2);
  // Spark x4: four takes, each a clone of the TV frame with its own Say, in parallel (fake Claude: every take gets the same recorded answer)
  await web.evaluate(() => window.__swift.fitAll()); await web.getByTestId('spark-button').click();
  await web.waitForFunction(() => /takes/.test(document.querySelector('[data-testid=spark-status]')?.textContent ?? ''), null, { timeout: 20000 }); cv.sparkStatus = (await web.textContent('[data-testid=spark-status]'))?.trim();
  cv.spark = await web.evaluate(async () => { const ids = window.__swift.frames.filter((f) => f.startsWith('tv-t')); const sizes = await Promise.all(ids.map((id) => window.__swift.get(id, 'clock', 'font-size'))); return { ids, sizes }; });
  // Keep one take, discard the rest: only the kept take stays (and the base frames are untouched)
  await web.evaluate(() => window.__swift.fitTo(['tv-t2'])); await web.waitForTimeout(200); const tp = await web.evaluate(() => { const v = window.__swift.view(); const r = document.querySelector('[data-testid=canvas]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await web.mouse.click(tp.x, tp.y); await web.waitForFunction(() => !document.querySelector('[data-testid=keep-take]').disabled, null, { timeout: 4000 });
  await web.getByTestId('keep-take').click(); await web.getByTestId('discard-takes').click(); await web.waitForTimeout(500);
  cv.takes = await web.evaluate(() => ({ spark: window.__swift.frames.filter((f) => f.startsWith('tv-t')), total: window.__swift.frames.length })); await web.evaluate(() => window.__swift.fitAll());
  // ⌘K focuses the Say input from anywhere (even with a popover open)
  await web.getByTestId('project-button').click(); await web.waitForSelector('[data-testid=import]'); await web.keyboard.press('Meta+k'); await web.waitForTimeout(150); cv.cmdK = await web.evaluate(() => ({ focused: document.activeElement?.getAttribute('data-testid'), importOpen: !!document.querySelector('[data-testid=import]') }));
  // Import a project: scan an allowed folder (this repo's own app/), refuse a folder outside the allowed roots; Escape closes with focus back
  const im = {}; await web.getByTestId('project-button').click(); await web.waitForSelector('[data-testid=import]'); await web.getByTestId('import-path').fill(`${root}/app`); await web.getByTestId('import-scan').click();
  await web.waitForFunction(() => /tokens/.test(document.querySelector('[data-testid=import-result]').textContent), null, { timeout: 8000 }); im.ok = (await web.textContent('[data-testid=import-result]')).replace(/\s+/g, ' ').trim().slice(0, 160);
  await web.getByTestId('import-path').fill('/etc'); await web.getByTestId('import-scan').click(); await web.waitForFunction(() => /not allowed/.test(document.querySelector('[data-testid=import-result]').textContent), null, { timeout: 8000 }); im.refused = true;
  await web.keyboard.press('Escape'); await web.waitForTimeout(150); im.escClosed = (await web.$('[data-testid=import]')) === null; im.focusBack = await web.evaluate(() => document.activeElement?.getAttribute('data-testid')); cv.import = im;
  // Appearance popover (rule H7) + theme persistence
  const th = {}; await web.getByTestId('appearance-button').click(); await web.waitForSelector('[data-testid=appearance]'); await web.getByRole('button', { name: 'Mount Fuji' }).click(); await web.waitForTimeout(250);
  th.bgAfterPick = await web.evaluate(() => getComputedStyle(document.querySelector('.kit-root')).getPropertyValue('--bg-image')); th.modeClass = await web.evaluate(() => document.querySelector('.kit-root').className);
  await web.getByRole('button', { name: 'Thick' }).click(); await web.waitForTimeout(150); th.blur = await web.evaluate(() => getComputedStyle(document.querySelector('.kit-root')).getPropertyValue('--blur'));
  await web.keyboard.press('Escape'); await web.waitForTimeout(150); th.escClosed = (await web.$('[data-testid=appearance]')) === null; th.focusBack = await web.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  await web.getByTestId('appearance-button').click(); await web.waitForSelector('[data-testid=appearance]'); await web.mouse.click(700, 500); await web.waitForTimeout(150); th.scrimClosed = (await web.$('[data-testid=appearance]')) === null;
  // Autosave: wait for the saved marker, then the reload must bring back the Spark takes and the edited colour
  await web.waitForFunction(() => document.querySelector('[data-testid=save-status]')?.textContent === 'saved', null, { timeout: 5000 }); await web.waitForTimeout(1300);
  const docBefore = await web.evaluate(async () => ({ n: window.__swift.frames.length, color: await window.__swift.get('tv', 'clock', 'color') }));
  await web.reload(); await web.waitForFunction(() => window.__theme && window.__swift && window.__swift.frames.length > 0); await web.waitForTimeout(500);
  cv.docRestored = await web.evaluate(async (b) => ({ sameFrames: window.__swift.frames.length === b.n, more: window.__swift.frames.length > 20, color: (await window.__swift.get('tv', 'clock', 'color')) === b.color }), docBefore);
  await web.waitForFunction(() => window.__theme && window.__swift); th.persisted = await web.evaluate(() => getComputedStyle(document.querySelector('.kit-root')).getPropertyValue('--bg-image').includes('fuji') && getComputedStyle(document.querySelector('.kit-root')).getPropertyValue('--blur').trim() === '48px');
  await web.evaluate(() => window.__theme.set({ bd: 'lake', mode: 'auto', glass: 'regular' })); await web.waitForTimeout(200); cv.theme = th;
  await web.screenshot({ path: `${root}/e2e/shot-canvas.png` }); out.canvas = cv;
  const ext = await ctx.newPage(); await ext.goto(`chrome-extension://${id}/app/index.html`); out.extension = await status(ext);
  await ext.waitForFunction(() => window.__swift && window.__swift.frames.length === 20); out.extEdit = await ext.evaluate(() => window.__swift.edit('tv', 'clock', 'font-size', '260px')); out.extRead = await ext.evaluate(() => window.__swift.get('tv', 'clock', 'font-size'));
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' }; const srv = http.createServer((q, r) => { const f = path.join(root, 'extension/app', q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; r.end(); } else { r.setHeader('content-type', mime[path.extname(f)] ?? 'application/octet-stream'); r.end(d); } }); }).listen(5199, '127.0.0.1'); procs.push({ kill: () => srv.close() });
  const bad = await ctx.newPage(); await bad.goto('http://127.0.0.1:5199/'); out.wrongOrigin = await status(bad);
  const c = out.canvas; const cv0 = c; const canvasOk = c.frames === 20 && c.sandbox && c.zoomed && c.panned && c.frozenFar.visible === 0 && c.frozenFar.hidden === 20 && c.edit.ok && c.edit.ms < 50 && c.tier0p95 < 16 && c.editRead === '260px' && c.editMissing.ok === false && c.hit === 'clock' && c.parentCannotReadFrame;
  const selOk = cv0.selected === 'clock' && cv0.layers.includes('clock') && cv0.layers.includes('recent') && cv0.inspectorEdit === '300px' && cv0.afterUndo === cv0.startFs && cv0.pickedLayer === 'date' && cv0.cleared === 'nothing selected';
  const sayOk = cv0.sayStatus.includes('3 applied') && cv0.sayStatus.includes('1 rejected') && cv0.sayApplied.fontSize === '300px' && cv0.sayApplied.dateOpacity === '0.5' && cv0.sayApplied.token === '#30d158' && cv0.sayUndone.fontSize === cv0.sayUndone.before && cv0.sayUndone.dateOpacity === cv0.sayUndone.beforeOp && cv0.sayUndone.status === 'Say undone';
  const themeOk = cv0.theme.bgAfterPick.includes('fuji') && cv0.theme.modeClass.includes('m-light') && cv0.theme.blur.trim() === '48px' && cv0.theme.escClosed && cv0.theme.focusBack === 'appearance-button' && cv0.theme.scrimClosed && cv0.theme.persisted;
  const sparkOk = cv0.spark.ids.length === 4 && cv0.spark.sizes.every((x) => x === '300px') && /4 takes · 4 changed/.test(cv0.sparkStatus) && /first paint/.test(cv0.sparkStatus);
  const importOk = /tokens/.test(cv0.import.ok) && cv0.import.ok.includes('files') && cv0.import.refused && cv0.import.escClosed && cv0.import.focusBack === 'project-button';
  const cmdKOk = cv0.cmdK.focused === 'say-input' && cv0.cmdK.importOpen === false;
  const extOk = out.extEdit.ok && out.extRead === '260px';
  const takesOk = cv0.takes.spark.length === 1 && cv0.takes.total === 21;
  const docOk = takesOk &&  cv0.docRestored.sameFrames && cv0.docRestored.more && cv0.docRestored.color;
  const ok = docOk && canvasOk && selOk && sayOk && sparkOk && importOk && cmdKOk && themeOk && extOk && out.web.includes('claude') && out.extension.includes('claude') && !out.wrongOrigin.includes('claude'); out.checks = { docOk, canvasOk, selOk, sayOk, sparkOk, importOk, cmdKOk, themeOk, extOk, web: out.web.includes('claude'), extension: out.extension.includes('claude'), wrongOrigin: !out.wrongOrigin.includes('claude') }; out.pass = ok; console.log(JSON.stringify(out, null, 1)); await ctx.close(); kill(); process.exit(ok ? 0 : 1);
} catch (e) { console.error(e); kill(); process.exit(1); }
