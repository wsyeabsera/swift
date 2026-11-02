// Real-Claude regression of the Say pipeline: 30 varied requests (spikes/localmodel/cases.json) through the REAL app code + helper + local Claude Code. Uses subscription (~30 small requests).
// node e2e/say-regression.mjs [count]
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const cases = JSON.parse(fs.readFileSync(`${root}/spikes/localmodel/cases.json`, 'utf8')); const N = Number(process.argv[2] ?? cases.length); const procs = [];
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout'); };
try {
  procs.push(spawn('npx', ['vite', '--config', 'vite.config.ts'], { cwd: root, stdio: 'ignore' })); await waitHttp('http://localhost:5173/');
  procs.push(spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...process.env, SWIFT_DEV: '1' }, stdio: 'ignore' })); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await p.goto('http://localhost:5173/');
  await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]').textContent), null, { timeout: 10000 }); await p.waitForTimeout(1500);
  const rows = [];
  for (const [req, route] of cases.slice(0, N)) {
    await p.getByTestId('say-input').fill(req); await p.getByTestId('say-input').focus(); await p.getByTestId('say-button').click();
    await p.waitForFunction(() => /applied|failed|asks|rejected/.test(document.querySelector('[data-testid=say-status]').textContent) && !document.querySelector('[data-testid=say-button]').disabled || /failed/.test(document.querySelector('[data-testid=say-status]').textContent), null, { timeout: 60000 });
    const st = (await p.textContent('[data-testid=say-status]')).trim(); const m = (re) => Number(st.match(re)?.[1] ?? 0);
    rows.push({ req, route, applied: m(/(\d+) applied/), rejected: m(/(\d+) rejected/), asked: /Claude asks/.test(st), firstMs: st.match(/first change (\d+) ms/) ? Number(st.match(/first change (\d+) ms/)[1]) : null, failed: /failed/.test(st), status: st });
    if (rows.at(-1).applied > 0) { await p.getByTestId('undo').click(); await p.waitForTimeout(250); } await p.waitForTimeout(500);
  }
  const good = rows.filter((r) => !r.failed && r.rejected === 0 && (r.applied > 0 || r.asked)); const times = rows.map((r) => r.firstMs).filter((x) => x !== null).sort((a, c) => a - c);
  console.log(JSON.stringify({ n: rows.length, valid: good.length, applied: rows.filter((r) => r.applied > 0).length, asked: rows.filter((r) => r.asked).length, rejectedLines: rows.reduce((a, r) => a + r.rejected, 0), failed: rows.filter((r) => r.failed).length, firstMsP50: times[Math.floor(times.length / 2)], firstMsP95: times[Math.floor(times.length * 0.95)], bad: rows.filter((r) => !good.includes(r)).map((r) => `${r.req} -> ${r.status}`) }, null, 1));
  fs.writeFileSync(`${root}/docs/say-regression.json`, JSON.stringify(rows, null, 1)); await b.close();
} finally { procs.forEach((x) => x.kill()); process.exit(0); }
