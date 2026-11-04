// Liquid Glass contrast in the REAL app: for every backdrop x mode x glass thickness and for every glass surface (the top islands, the layers and inspector panels, the Say bar and tools bar,
// the Frame menu popover, the shortcuts sheet) plus the frame labels that sit straight on the canvas: hide the text, screenshot the surface, take the worst-case background luminance
// (light text -> brightest 90th percentile, dark text -> darkest 10th) and check WCAG >= 4.5 for --tx and --mu. Run it after ANY theme or glass change.
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import path from 'node:path';
import { TEST_URL, viteEnv } from './env.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const MIN = 4.5;
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout'); };
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, env: viteEnv, stdio: 'ignore' });
// Groups of surfaces: a selector for the glass whose text we check. `open` says what has to be on screen first.
const GROUPS = [
  { name: 'top islands', sel: '.kit-top .gl' }, { name: 'panels', sel: '[data-testid=layers], [data-testid=inspector]' }, { name: 'say + tools', sel: 'form.say, footer.tools' },
  { name: 'frame menu', sel: '[data-testid=frame-popover]', open: 'menu' }, { name: 'shortcuts sheet', sel: '[data-testid=shortcuts]', open: 'keys' },
  { name: 'frame labels (on the canvas)', sel: '[data-testid=frame-label]', labels: true },
];
try {
  await waitHttp(TEST_URL);
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(TEST_URL); await p.waitForFunction(() => window.__theme && window.__swift); await p.waitForTimeout(600); const rows = [];
  const measure = async (sel, labels) => { // [worst luminance quantile list] per rect, text hidden while the screenshot is taken
    const rects = await p.evaluate(({ sel, labels }) => { const st = document.createElement('style'); st.id = 'hide'; st.textContent = '.gl *,.fr-label{color:transparent!important;fill:transparent!important;text-shadow:none!important}'; document.head.appendChild(st);
      return [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight; }).slice(0, labels ? 4 : 8).map((e) => { const r = e.getBoundingClientRect(); return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, innerWidth - Math.max(0, r.x)), height: Math.min(r.height, innerHeight - Math.max(0, r.y)) }; }); }, { sel, labels });
    const lum = []; for (const r of rects) { const buf = await p.screenshot({ clip: r }); lum.push(...await p.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; const out = []; const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; for (let i = 0; i < d.length; i += 16) out.push(.2126 * f(d[i]) + .7152 * f(d[i + 1]) + .0722 * f(d[i + 2])); return out; }, buf.toString('base64'))); }
    await p.evaluate(() => document.getElementById('hide')?.remove()); lum.sort((a, c) => a - c); return { n: rects.length, lum };
  };
  const colours = () => p.evaluate(() => { const css = getComputedStyle(document.querySelector('.kit-root')); const sp = document.createElement('span'); document.body.appendChild(sp); const rgb = (c) => { sp.style.color = c; const m = getComputedStyle(sp).color.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2] }; }; const out = { tx: rgb(css.getPropertyValue('--tx').trim()), mu: rgb(css.getPropertyValue('--mu').trim()) }; sp.remove(); return out; });
  const Lf = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  for (const bd of ['milkyway', 'aurora', 'lake', 'fuji', 'dunes', 'glass', 'manhattan', 'mesh']) for (const mode of ['dark', 'light']) for (const glass of ['thin', 'regular', 'thick']) {
    await p.evaluate((t) => window.__theme.set(t), { bd, mode, glass, accent: 'Mint' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300); const col = await colours();
    for (const g of GROUPS) {
      if (g.open === 'menu') await p.getByTestId('frame-menu').click(); if (g.open === 'keys') await p.keyboard.press('?'); if (g.open) await p.waitForTimeout(260);
      if (g.labels) { await p.evaluate(() => window.__swift.fitTo(['tv'])); await p.waitForTimeout(250); } const m = await measure(g.sel, g.labels); if (g.labels) await p.evaluate(() => window.__swift.fitAll()); if (g.open) { await p.keyboard.press('Escape'); await p.waitForTimeout(120); } if (!m.n) { rows.push({ bd, mode, glass, group: g.name, error: 'surface not found' }); continue; }
      const q = (f) => m.lum[Math.min(m.lum.length - 1, Math.floor(m.lum.length * f))]; const ratio = (c) => { const lt = Lf(c); const lb = lt > .5 ? q(.9) : q(.1); return (Math.max(lt, lb) + .05) / (Math.min(lt, lb) + .05); };
      rows.push({ bd, mode, glass, group: g.name, tx: +ratio(col.tx).toFixed(2), mu: +ratio(col.mu).toFixed(2) });
    }
  }
  const bad = rows.filter((r) => r.error || r.tx < MIN || r.mu < MIN); const ok = rows.filter((r) => !r.error); const lowest = ok.reduce((m, r) => Math.min(m, r.tx, r.mu), 99);
  const perGroup = Object.fromEntries(GROUPS.map((g) => { const r = ok.filter((x) => x.group === g.name); return [g.name, { combos: r.length, lowest: r.length ? Math.min(...r.flatMap((x) => [x.tx, x.mu])) : null, below: r.filter((x) => x.tx < MIN || x.mu < MIN).length }]; }));
  console.log(JSON.stringify({ combos: rows.length, belowMin: bad.length, lowest, perGroup, bad: bad.filter((r) => !r.error).slice(0, 30) }, null, 1)); await b.close(); vite.kill(); process.exit(bad.length ? 1 : 0);
} catch (e) { console.error(e); vite.kill(); process.exit(1); }
