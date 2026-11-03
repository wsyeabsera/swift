// Nightly eval of Say/Spark on the REAL local Claude Code (uses subscription; never part of `npm run e2e`).
// node e2e/nightly-eval.mjs   (LIMIT=6 to cap requests; REPORT=path to override output). Exit 1 on regression, 2 on a broken run.
import { chromium } from 'playwright-core'; import { spawn, execSync } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const reportPath = process.env.REPORT ?? `${root}/e2e/nightly-report.json`; const procs = [];
const reqs = JSON.parse(fs.readFileSync(process.env.REQUESTS ?? `${root}/e2e/nightly-requests.json`, 'utf8')); const LIMIT = Number(process.env.LIMIT ?? reqs.length);
const list = reqs.slice(0, LIMIT).sort((a, b) => (a.project === 'blank') - (b.project === 'blank')); // tvdash first, blank project last (switching reloads)
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout'); };
const pct = (xs, q) => { const s = xs.filter((x) => x !== null).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : null; };
const sec = (st) => { const m = st.match(/([\d.]+) s\b/); return m ? Math.round(Number(m[1]) * 1000) : null; };
// Diversity of a Spark: mean pairwise Jaccard distance over each take's set of style declarations + text.
const bag = (h) => new Set([...(h.match(/[\w-]+:[^;"}]+/g) ?? []), ...(h.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean))]);
const diversity = (hs, base) => { if (hs.length < 2) return null; const bb = bag(base ?? ''); const b = hs.map((h) => new Set([...bag(h)].filter((v) => !bb.has(v)))); // only what each take CHANGED vs the base, the shared bulk would hide the difference
  let sum = 0, n = 0; for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) { const u = new Set([...b[i], ...b[j]]).size; const x = [...b[i]].filter((v) => b[j].has(v)).length; sum += u ? 1 - x / u : 0; n++; } return Math.round((sum / n) * 100) / 100; };
const rows = []; let fatal = null;
try {
  procs.push(spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, stdio: 'ignore' })); await waitHttp('http://localhost:5173/');
  procs.push(spawn(`${root}/target/debug/swift-canvas-helper`, [], { env: { ...process.env, SWIFT_DEV: '1', SWIFT_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sc-nightly-')), SWIFT_PROJECT_ROOTS: root }, stdio: 'ignore' })); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await p.goto('http://localhost:5173/');
  const ready = async () => { await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]')?.textContent ?? ''), null, { timeout: 15000 }); await p.getByTestId('say-input').focus(); await p.waitForTimeout(2500); };
  await ready(); let onBlank = false;
  for (const r of list) {
    if (r.project === 'blank' && !onBlank) { // new project from a scanned folder (this repo's app/): starts with one blank screen
      await p.getByTestId('project-button').click(); await p.waitForSelector('[data-testid=import]'); await p.getByTestId('import-path').fill(`${root}/app`); await p.getByTestId('import-scan').click();
      await p.waitForFunction(() => /tokens/.test(document.querySelector('[data-testid=import-result]')?.textContent ?? ''), null, { timeout: 8000 }); await p.getByTestId('import-create').click();
      await p.waitForTimeout(1500); await ready(); await p.waitForFunction(() => window.__swift.frames.length === 1, null, { timeout: 8000 }); onBlank = true;
    }
    const row = { id: r.id, class: r.class, kind: r.kind, request: r.request ?? null, valid: false, applied: 0, rejected: 0, firstMs: null, totalMs: null, failed: false, status: '' };
    try {
      if (r.kind === 'say') {
        await p.evaluate(() => window.__swift.fitTo(['tv'])); await p.waitForTimeout(200); await p.mouse.click(...(await p.evaluate(() => { const v = window.__swift.view(); return [v.x + 40 * v.s, v.y + 40 * v.s]; }))); await p.waitForTimeout(300); // the frame root, then the layer button
        if (r.select) { await p.getByRole('button', { name: new RegExp('^' + r.select) }).first().click(); await p.waitForTimeout(300); } else { await p.mouse.click(5, 700); await p.waitForTimeout(200); } // otherwise: nothing selected
        await p.evaluate(() => { const e = document.querySelector('[data-testid=say-status]'); if (e) e.textContent = ''; }); await p.getByTestId('say-input').fill(r.request); await p.getByTestId('say-input').focus(); await p.getByTestId('say-button').click();
        await p.waitForFunction(() => { const t = document.querySelector('[data-testid=say-status]')?.textContent ?? ''; return t !== 'Saying…' && /applied|failed|asks|rejected|^Local ·|not ready|→ .+: \d+ places? in \d+ frames?/.test(t); }, null, { timeout: 90000 }); // the button stays disabled (input is cleared on send), so wait on the status text
        const st = (await p.textContent('[data-testid=say-status]')).trim(); const m = (re) => Number(st.match(re)?.[1] ?? 0); const asked = /Claude asks/.test(st);
        Object.assign(row, { status: st, applied: m(/(\d+) applied/), rejected: m(/(\d+) rejected/), failed: /failed/.test(st), firstMs: st.match(/first change (\d+) ms/) ? Number(st.match(/first change (\d+) ms/)[1]) : (st.match(/^Local .* (\d+) ms$/) ? Number(st.match(/^Local .* (\d+) ms$/)[1]) : (st.match(/ · (\d+) ms$/) ? Number(st.match(/ · (\d+) ms$/)[1]) : null)), totalMs: sec(st) });
        row.valid = !row.failed && row.rejected === 0 && (row.applied > 0 || asked || /^Local ·/.test(st) || /→ .+: \d+ places? in \d+ frames?/.test(st));
        if (row.applied > 0) { await p.getByTestId('undo').click(); await p.waitForTimeout(250); } if (asked) { await p.reload(); await ready(); } // an `ask` leaves the next request as its ANSWER: start clean
      } else {
        await p.evaluate(() => window.__swift.fitAll()); await p.getByTestId('spark-button').click();
        await p.waitForFunction(() => /takes|not ready|cannot|failed/i.test(document.querySelector('[data-testid=spark-status]')?.textContent ?? '') && !/Sparking/.test(document.querySelector('[data-testid=spark-status]')?.textContent ?? ''), null, { timeout: 120000 });
        const st = (await p.textContent('[data-testid=spark-status]')).trim(); const m = (re) => Number(st.match(re)?.[1] ?? 0);
        Object.assign(row, { status: st, applied: m(/(\d+) changed/), rejected: m(/(\d+) rejected/), firstMs: st.match(/first paint (\d+) ms/) ? Number(st.match(/first paint (\d+) ms/)[1]) : null, totalMs: sec(st), failed: !/\d+ takes/.test(st) });
        row.valid = !row.failed && row.applied === 4 && row.rejected === 0;
        const { htmls, base } = await p.evaluate(async () => { const f = window.__swift.frames.filter((id) => /-t\d+$/.test(id)); const o = window.__swift.frames.find((id) => !/-t\d+$/.test(id)); return { htmls: await Promise.all(f.map((id) => window.__swift.snapshot(id))), base: await window.__swift.snapshot(o) }; }); row.diversity = diversity(htmls, base); // take-to-take difference, 0 identical .. 1 disjoint
        const d = p.getByTestId('discard-takes'); if (await d.count()) { await d.click(); await p.waitForTimeout(300); }
      }
    } catch (e) { row.failed = true; row.status = `harness: ${String(e.message).split('\n')[0]}`; }
    rows.push(row); await p.waitForTimeout(500);
  }
  await b.close();
} catch (e) { fatal = String(e.message ?? e); } finally { procs.forEach((x) => x.kill()); }
// --- report
const classes = [...new Set(rows.map((r) => r.class))]; const stats = {};
for (const c of classes) { const rs = rows.filter((r) => r.class === c); stats[c] = { n: rs.length, validRate: rs.filter((r) => r.valid).length / rs.length, p50FirstMs: pct(rs.map((r) => r.firstMs), 0.5), p95FirstMs: pct(rs.map((r) => r.firstMs), 0.95), p50TotalMs: pct(rs.map((r) => r.totalMs), 0.5) }; }
// previous report if any, else baseline docs/say-regression.json (Say only; its routes property/token/full map to property/token/add)
let prev = null, prevSrc = null; try { prev = JSON.parse(fs.readFileSync(reportPath, 'utf8')).stats; prevSrc = 'previous report'; } catch {}
if (!prev) { try { const base = JSON.parse(fs.readFileSync(`${root}/docs/say-regression.json`, 'utf8')); prev = {}; for (const [route, c] of [['property', 'property'], ['token', 'token'], ['full', 'add']]) { const rs = base.filter((r) => r.route === route); if (!rs.length) continue; prev[c] = { validRate: rs.filter((r) => !r.failed && r.rejected === 0 && (r.applied > 0 || r.asked)).length / rs.length, p95FirstMs: pct(rs.map((r) => r.firstMs), 0.95) }; } prevSrc = 'docs/say-regression.json'; } catch {} }
const regressions = [];
if (fatal) regressions.push(`run aborted: ${fatal}`);
for (const [c, s] of Object.entries(stats)) { const o = prev?.[c]; if (!o) continue;
  if (s.validRate < o.validRate - 1e-9) regressions.push(`${c}: valid rate ${(o.validRate * 100).toFixed(0)}% -> ${(s.validRate * 100).toFixed(0)}%`);
  if (s.n >= 3 && (o.n ?? 3) >= 3 && o.p95FirstMs && s.p95FirstMs && s.p95FirstMs > o.p95FirstMs * 1.25) regressions.push(`${c}: p95 first change ${o.p95FirstMs} -> ${s.p95FirstMs} ms (+${Math.round((s.p95FirstMs / o.p95FirstMs - 1) * 100)}%)`); }
let version = ''; try { version = execSync('claude --version', { encoding: 'utf8' }).trim(); } catch {}
const report = { date: new Date().toISOString(), model: `${process.env.SWIFT_CLAUDE_MODEL || 'haiku'} via claude-code ${version}`, comparedTo: prevSrc, limit: LIMIT, results: rows, stats, regressions };
fs.writeFileSync(LIMIT < reqs.length && !process.env.REPORT ? reportPath.replace(/\.json$/, '.partial.json') : reportPath, JSON.stringify(report, null, 1)); // a LIMITed smoke run never replaces the baseline
console.log(`nightly eval ${report.date.slice(0, 10)} · ${rows.length} requests · vs ${prevSrc ?? 'nothing'}`);
for (const [c, s] of Object.entries(stats)) console.log(`${c.padEnd(12)} n=${s.n} valid=${(s.validRate * 100).toFixed(0)}% first p50/p95=${s.p50FirstMs ?? '-'}/${s.p95FirstMs ?? '-'} ms total p50=${s.p50TotalMs ?? '-'} ms${c.includes('spark') ? ` diversity=${rows.filter((r) => r.class === c).map((r) => r.diversity ?? '-').join('/')}` : ''}`);
for (const r of rows.filter((x) => !x.valid)) console.log(`BAD ${r.id}: ${r.status}`);
console.log(regressions.length ? `REGRESSIONS:\n - ${regressions.join('\n - ')}` : 'no regressions');
process.exit(fatal ? 2 : regressions.length ? 1 : 0);
