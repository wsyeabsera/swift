// Spike #1714: what does an MV3 extension page + sandboxed frames + localhost helper actually allow? (Playwright Chromium, headed)
import { createRequire } from 'node:module'; import path from 'node:path'; import os from 'node:os'; import fs from 'node:fs';
import { startHelper } from './helper.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const dir = path.dirname(new URL(import.meta.url).pathname); const ext = path.join(dir, 'ext');
const PAGE = 47320, WS = 47321, token = 'spike-secret';
const pageSrv = (await startHelper({ port: PAGE, token, allowedOrigin: '' })).server; // plain page to capture
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'spike-host-')), { headless: false, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
let sw = ctx.serviceWorkers()[0]; if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
const id = new URL(sw.url()).host; console.log('extension id', id);
const { server: helper, log } = await startHelper({ port: WS, token, allowedOrigin: `chrome-extension://${id}`, streamS: 20 });
const target = await ctx.newPage(); await target.goto(`http://127.0.0.1:${PAGE}/`);
const app = await ctx.newPage(); await app.goto(`chrome-extension://${id}/app.html`);
await app.evaluate(cfg => window.startSpike(cfg), { pagePort: String(PAGE), wsPort: WS, token });
await app.waitForFunction('window.__results && window.__results.done', null, { timeout: 60000 });
const res = await app.evaluate(() => window.__results);
// a plain web page (wrong origin) must be refused by the helper
const evil = await ctx.newPage(); await evil.goto(`http://127.0.0.1:${PAGE}/`);
res.wrongOriginAccepted = await evil.evaluate(({ WS, token }) => new Promise(r => { const w = new WebSocket(`ws://127.0.0.1:${WS}/?token=${token}`); w.onopen = () => r(true); w.onerror = () => r(false); setTimeout(() => r(false), 3000); }), { WS, token });
res.helperLog = log;
console.log(JSON.stringify(res, null, 1)); fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(res, null, 1));
await ctx.close(); helper.close(); pageSrv.close(); process.exit(0);
