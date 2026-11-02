// Spike #1744: real DOM frames to bitmaps at time t (deterministic via the Web Animations API), CDP screenshot throughput and determinism.
import { createRequire } from 'node:module'; import path from 'node:path'; import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/yab/.nvm/versions/node/v24.20.0/lib/node_modules/playwright-core');
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); await p.goto('file://' + path.resolve('dom-frame.html')); await p.waitForTimeout(500);
const cdp = await p.context().newCDPSession(p);
await p.evaluate(() => document.getAnimations().forEach(a => a.pause()));
const setT = (ms) => p.evaluate(t => document.getAnimations().forEach(a => { a.currentTime = t; }), ms);
const cap = async (fmt, q) => (await cdp.send('Page.captureScreenshot', { format: fmt, ...(q ? { quality: q } : {}), optimizeForSpeed: true })).data;
const hash = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 8);
const out = {};
// determinism: same time twice, different time
await setT(2500); const a1 = await cap('png'); await setT(9000); await cap('png'); await setT(2500); const a2 = await cap('png'); out.deterministic = hash(a1) === hash(a2);
async function run(label, fmt, q, frames) { const t0 = performance.now(); let bytes = 0; for (let i = 0; i < frames; i++) { await setT(i * (1000 / 30)); const d = await cap(fmt, q); bytes += d.length * 0.75; } const ms = performance.now() - t0; out[label] = { frames, msPerFrame: +(ms / frames).toFixed(1), fps: +(frames / (ms / 1000)).toFixed(1), avgKB: Math.round(bytes / frames / 1024), clip30fpsSecondsToRender5s: +(150 * ms / frames / 1000).toFixed(1) }; }
await run('cdp-jpeg85', 'jpeg', 85, 60); await run('cdp-jpeg95', 'jpeg', 95, 60); await run('cdp-png', 'png', 0, 40);
// playwright screenshot for comparison
const t0 = performance.now(); for (let i = 0; i < 30; i++) { await setT(i * 33); await p.screenshot({ type: 'jpeg', quality: 85 }); } out['playwright-jpeg85'] = { msPerFrame: +((performance.now() - t0) / 30).toFixed(1) };
// does the backdrop blur survive? sample the glass panel region average brightness variance (blurred content = low variance)
await setT(1000); const png = Buffer.from(await cap('png'), 'base64'); out.pngBytes = png.length;
console.log(JSON.stringify(out, null, 1)); await b.close();
