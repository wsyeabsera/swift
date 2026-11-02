// Liquid Glass contrast in the REAL app: for every backdrop x mode x glass thickness, hide the text on the top islands, screenshot the glass,
// take the worst-case background luminance (light text -> brightest 90th percentile, dark text -> darkest 10th) and check WCAG >= 4.5 for --tx and --mu.
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const MIN = 4.5;
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout'); };
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, stdio: 'ignore' });
try {
  await waitHttp('http://localhost:5173/');
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:5173/'); await p.waitForFunction(() => window.__theme); const rows = [];
  for (const bd of ['milkyway', 'aurora', 'lake', 'fuji', 'dunes', 'glass', 'manhattan', 'mesh']) for (const mode of ['dark', 'light']) for (const glass of ['thin', 'regular', 'thick']) {
    await p.evaluate((t) => window.__theme.set(t), { bd, mode, glass, accent: 'Mint' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(350);
    const info = await p.evaluate(() => { const css = getComputedStyle(document.querySelector('.kit-root')); const sp = document.createElement('span'); document.body.appendChild(sp);
      const rgb = (c) => { sp.style.color = c; const m = getComputedStyle(sp).color.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
      const st = document.createElement('style'); st.id = 'hide'; st.textContent = '.kit-top .gl *{color:transparent!important;fill:transparent!important}'; document.head.appendChild(st);
      return { tx: rgb(css.getPropertyValue('--tx').trim()), mu: rgb(css.getPropertyValue('--mu').trim()), rects: [...document.querySelectorAll('.kit-top .gl')].slice(0, 3).map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) }; });
    const lum = [];
    for (const r of info.rects) { const buf = await p.screenshot({ clip: r }); lum.push(...await p.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; const L = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; const o = []; for (let i = 0; i < d.length; i += 16) o.push(.2126 * L(d[i]) + .7152 * L(d[i + 1]) + .0722 * L(d[i + 2])); return o; }, buf.toString('base64'))); }
    await p.evaluate(() => document.getElementById('hide')?.remove()); lum.sort((a, c) => a - c); const q = (f) => lum[Math.min(lum.length - 1, Math.floor(lum.length * f))];
    const Lf = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
    const ratio = (c) => { const lt = Lf(c); const lb = lt > .5 ? q(.9) : q(.1); const hi = Math.max(lt, lb), lo = Math.min(lt, lb); return (hi + .05) / (lo + .05); };
    rows.push({ bd, mode, glass, tx: +ratio(info.tx).toFixed(2), mu: +ratio(info.mu).toFixed(2) });
  }
  const bad = rows.filter((r) => r.tx < MIN || r.mu < MIN); const lowest = rows.reduce((m, r) => Math.min(m, r.tx, r.mu), 99);
  console.log(JSON.stringify({ combos: rows.length, belowMin: bad.length, lowest, bad }, null, 1)); await b.close(); vite.kill(); process.exit(bad.length ? 1 : 0);
} catch (e) { console.error(e); vite.kill(); process.exit(1); }
