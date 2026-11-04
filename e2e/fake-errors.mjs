// Error scenarios on a fake Claude Code, driving the REAL app (Vite + Rust helper + Chromium). No real Claude. node e2e/fake-errors.mjs
// Prints one JSON line per scenario {name, pass, detail}; exits 1 if any fails (2 if port TEST.helperPort is taken). Needs: cargo build, Playwright's Chromium.
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path'; import net from 'node:net';
import { TEST_URL, viteEnv, helperEnv, TEST } from './env.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const procs = []; const results = [];
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout ' + url); };
const inUse = (port) => new Promise((res) => { const c = net.connect(port, '127.0.0.1'); c.on('connect', () => { c.destroy(); res(true); }); c.on('error', () => res(false)); });
if (await inUse(TEST.helperPort)) { console.error('port TEST.helperPort is already in use: stop the other helper first'); process.exit(2); }
const modeFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sc-fe-')), 'mode.json'); const setMode = (mode) => fs.writeFileSync(modeFile, JSON.stringify({ mode, n: 0 })); setMode('ok');
try {
  procs.push(spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, env: viteEnv, stdio: 'ignore' })); await waitHttp(TEST_URL);
  procs.push(spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...helperEnv, SWIFT_DEV: '1', SWIFT_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sc-fe-data-')), SWIFT_CLAUDE_BIN: `${root}/e2e/fixtures/fake-claude-errors.mjs`, FAKE_MODE_FILE: modeFile }, stdio: 'ignore' })); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await p.goto(TEST_URL);
  await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]').textContent), null, { timeout: 10000 }); await p.waitForTimeout(500);
  const fs0 = () => p.evaluate(() => window.__swift.get('tv', 'clock', 'font-size')); const start = await fs0();
  const say = async (mode, text) => { setMode(mode); if (await p.getByTestId('claude-recheck').count()) { await p.getByTestId('claude-recheck').click(); await p.waitForFunction(() => !document.querySelector('[data-testid=claude-recheck]'), null, { timeout: 8000 }); } /* the previous scenario may have left 'limit reached': re-check like a user would */ await p.evaluate(() => window.__swift.fitAll()); await p.getByTestId('say-input').fill(text); await p.getByTestId('say-button').click();
    await p.waitForFunction(() => { const t = document.querySelector('[data-testid=say-status]')?.textContent?.trim() ?? ''; return t !== '' && !/^Saying/.test(t); }, null, { timeout: 15000 }); await p.waitForTimeout(400); return (await p.textContent('[data-testid=say-status]')).trim(); };
  const undo = async () => { await p.getByTestId('undo').click(); await p.waitForTimeout(400); return fs0(); };
  const run = async (name, fn) => { let r; try { r = await fn(); } catch (e) { r = { pass: false, detail: String(e?.message ?? e).slice(0, 300) }; } results.push({ name, ...r }); console.log(JSON.stringify({ name, ...r })); };
  await run('exit-without-answer', async () => { const s = await say('exit', 'make the clock bigger and the date fainter'); const f = await fs0(); return { pass: /failed/i.test(s) && /without an answer/.test(s) && f === start, detail: `${s} | font ${f}` }; });
  await run('usage-limit', async () => { const s = await say('limit', 'make the clock bigger and the date fainter'); const f = await fs0(); return { pass: /failed/i.test(s) && /usage limit/i.test(s) && f === start, detail: `${s} | font ${f}` }; });
  await run('malformed-line-mixed', async () => { const s = await say('mixed', 'make the clock bigger and the date fainter'); const f = await fs0(); const u = await undo(); return { pass: /^1 applied/.test(s) && /1 rejected/.test(s) && f === '222px' && u === start, detail: `${s} | font ${f}, after undo ${u}` }; });
  await run('killed-mid-stream', async () => { const s = await say('kill', 'make the clock bigger and the date fainter'); const f = await fs0(); const err = /fail|error|ended|without an answer/i.test(s);
    const u = await undo(); const s2 = await say('ok', 'make the clock bigger and the date fainter'); const f2 = await fs0(); const u2 = await undo();
    return { pass: err && u === start && /^1 applied/.test(s2) && f2 === '222px' && u2 === start, detail: `${s} | font ${f}, undo ${u}; next: ${s2} | font ${f2}, undo ${u2}; errorShown=${err}` }; });
  await b.close();
} catch (e) { console.error(e); results.push({ name: 'harness', pass: false }); }
finally { procs.forEach((x) => x.kill()); process.exit(results.length >= 4 && results.every((r) => r.pass) ? 0 : 1); }
