// Spike #1706: pan/zoom frame times, Tier-0 edit latency and memory for 4 frame models. Headed system Chrome (real GPU).
// usage: node measure.mjs [n=20]   (close other heavy work first: results are noisy while other Chrome/Playwright runs)
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import path from 'node:path'; import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/yab/.nvm/versions/node/v24.20.0/lib/node_modules/playwright-core');
const N = process.argv[2] || '20'; const dir = path.dirname(new URL(import.meta.url).pathname);
const rss = (pid) => { const rows = execSync('ps -axo pid=,ppid=,rss=').toString().trim().split('\n').map(l => l.trim().split(/\s+/).map(Number)); const kids = new Set([pid]); let grew = true; while (grew) { grew = false; for (const [p, pp] of rows) if (kids.has(pp) && !kids.has(p)) { kids.add(p); grew = true; } } return Math.round(rows.filter(r => kids.has(r[0])).reduce((a, r) => a + r[2], 0) / 1024); };
const mainPid = () => { const l = execSync('ps -axo pid=,command=').toString().split('\n').find(x => x.includes('--window-size=1440,960') && !x.includes('Helper') && x.includes('Google Chrome')); return Number(l.trim().split(/\s+/)[0]); };
const results = [];
for (const mode of ['plain', 'shadow', 'same', 'sandbox']) for (const freeze of ['0', '1']) {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: false, args: ['--window-size=1440,960', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion'] });
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`file://${dir}/index.html?mode=${mode}&n=${N}&freeze=${freeze}`); await page.waitForFunction('window.__ready');
  const r = await page.evaluate(() => window.runBench()); r.rssMB = rss(mainPid()); results.push(r);
  console.log(`${mode.padEnd(8)} freeze=${freeze} n=${N} | pan p50 ${r.pan.p50} p95 ${r.pan.p95} max ${r.pan.max} >20ms ${r.pan.over20}/${r.pan.n} | zoom p95 ${r.zoom.p95} max ${r.zoom.max} | tier0(visible ${r.visibleFrames}) p50 ${r.tier0.p50} p95 ${r.tier0.p95} ms | RSS ${r.rssMB} MB`);
  await b.close();
}
fs.writeFileSync(`${dir}/results-n${N}.json`, JSON.stringify(results, null, 1));
