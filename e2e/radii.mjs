// Concentric radii check (Liquid Glass rule, KIT.md section I): a rounded element inside a rounded container should have inner radius = outer radius - the gap between their edges
// (a button in a pill, a field in a popover), so the corners look nested. In the REAL app: for the base screen, the Frame menu and the shortcuts sheet, find every pair where the child's
// corner lies inside the container's corner curve, and flag those that are off by more than the tolerance. `npm run e2e:radii`; exits 1 on violations.
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import path from 'node:path';
import { TEST_URL, viteEnv } from './env.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const TOL = 3; // px
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout'); };
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, env: viteEnv, stdio: 'ignore' });
const scan = (TOL) => document.fonts.ready.then(() => {
  const eff = (e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); const v = (s) => parseFloat(s) || 0; const tl = v(cs.borderTopLeftRadius), tr = v(cs.borderTopRightRadius), bl = v(cs.borderBottomLeftRadius), br = v(cs.borderBottomRightRadius); const cap = Math.min(r.width, r.height) / 2; return { r, tl: Math.min(tl, cap), tr: Math.min(tr, cap), bl: Math.min(bl, cap), br: Math.min(br, cap) }; };
  const name = (e) => `${e.tagName.toLowerCase()}${e.dataset.testid ? '[' + e.dataset.testid + ']' : e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
  const out = []; const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 6 && r.height > 6 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight; };
  const roots = [...document.querySelectorAll('.gl, .pop')]; const seen = new Set();
  for (const root of roots) for (const el of root.querySelectorAll('*')) {
    if (seen.has(el) || !visible(el)) continue; const c = eff(el); if (Math.max(c.tl, c.tr, c.bl, c.br) < 4) continue; // a nearly square child is not a nested curve
    let p = el.parentElement; while (p && p !== document.body) { const pe = eff(p); if (Math.max(pe.tl, pe.tr, pe.bl, pe.br) >= 4 && visible(p)) break; p = p.parentElement; } if (!p || p === document.body) continue; const pe = eff(p);
    // the corner that is closest to the container's matching corner decides: only corners that actually sit in the curve are checked
    const corners = [['tl', c.r.left - pe.r.left, c.r.top - pe.r.top], ['tr', pe.r.right - c.r.right, c.r.top - pe.r.top], ['bl', c.r.left - pe.r.left, pe.r.bottom - c.r.bottom], ['br', pe.r.right - c.r.right, pe.r.bottom - c.r.bottom]];
    for (const [k, dx, dy] of corners) { const outer = pe[k]; const inset = Math.min(dx, dy); if (outer < 6 || inset < 0 || dx > outer || dy > outer) continue; const want = Math.max(0, outer - inset); if (Math.abs(c[k] - want) > TOL && !(want < 2 && c[k] < 2)) { out.push({ el: name(el), parent: name(p), corner: k, inner: +c[k].toFixed(1), outer: +outer.toFixed(1), inset: +inset.toFixed(1), want: +want.toFixed(1) }); seen.add(el); break; } }
  }
  return out;
});
try {
  await waitHttp(TEST_URL);
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(TEST_URL); await p.waitForFunction(() => window.__swift && window.__theme); await p.waitForSelector('[data-testid=layers]'); await p.waitForTimeout(800); const found = {};
  // the detector must work: a mismatched pair (inner 24 where about 19-20 is expected) is flagged, a correctly nested pair is not
  await p.evaluate(() => { const mk = (id, inner) => { const o = document.createElement('div'); o.className = 'gl'; o.id = id; o.style.cssText = 'position:fixed;left:400px;top:300px;width:200px;height:120px;border-radius:24px;z-index:99'; const c = document.createElement('div'); c.id = id + '-c'; c.style.cssText = `position:absolute;left:4px;top:4px;width:80px;height:60px;border-radius:${inner}px`; o.appendChild(c); document.body.appendChild(o); }; mk('rt-bad', 24); mk('rt-good', 20); document.getElementById('rt-good').style.left = '700px'; });
  const self = await p.evaluate(scan, TOL); await p.evaluate(() => { document.getElementById('rt-bad')?.remove(); document.getElementById('rt-good')?.remove(); });
  const flaggedBad = self.some((x) => x.inner === 24 && x.outer === 24), flaggedGood = self.some((x) => x.inner === 20); /* the 1px glass border makes the inset 5, so 19 is exact and 20 is within the tolerance */ if (!flaggedBad || flaggedGood) throw new Error(`the self-test failed (bad flagged: ${flaggedBad}, good flagged: ${flaggedGood}); the detector cannot be trusted`);
  found.base = await p.evaluate(scan, TOL);
  await p.getByTestId('frame-menu').click(); await p.waitForTimeout(500); found.frameMenu = await p.evaluate(scan, TOL); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.keyboard.press('?'); await p.waitForTimeout(500); found.shortcuts = await p.evaluate(scan, TOL); await p.keyboard.press('Escape');
  const all = Object.entries(found).flatMap(([screen, v]) => v.map((x) => ({ screen, ...x }))); const uniq = [...new Map(all.map((x) => [`${x.el}|${x.parent}|${x.corner}`, x])).values()];
  console.log(JSON.stringify({ tolerancePx: TOL, violations: uniq.length, list: uniq }, null, 1)); await b.close(); vite.kill(); process.exit(uniq.length ? 1 : 0);
} catch (e) { console.error(e); vite.kill(); process.exit(1); }
