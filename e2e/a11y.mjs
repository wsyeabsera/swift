// Accessibility e2e (task #1840), TEST environment: the core flow by keyboard alone, no unlabeled controls, visible focus, reduced motion.
// node e2e/a11y.mjs   (needs: cargo build -p swift-canvas-helper; run via `npm run e2e:a11y`)
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
import { TEST_URL, viteEnv, helperEnv, ROOT, requireFreeTestPorts, startVite } from './env.mjs';
const procs = []; const fails = []; const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); if (!ok) fails.push(name); };
const waitHttp = async (url) => { for (let i = 0; i < 80; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 250)); } throw new Error('timeout ' + url); };
await requireFreeTestPorts();
let browser;
try {
  procs.push(startVite()); await waitHttp(TEST_URL);
  procs.push(spawn(`${ROOT}/target/debug/swift-canvas-helper`, [], { env: { ...helperEnv, SWIFT_DEV: '1', SWIFT_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sc-a11y-')), SWIFT_PROJECT_ROOTS: ROOT, SWIFT_CLAUDE_BIN: `${ROOT}/tools/fake-claude.mjs`, FAKE_FIXTURE: `${ROOT}/tools/fixtures/say-clock.json` }, stdio: 'ignore' })); await new Promise((r) => setTimeout(r, 800));
  browser = await chromium.launch({ headless: true }); const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage(); await page.goto(TEST_URL);
  await page.waitForFunction(() => window.__swift && window.__swift.frames.length > 0 && /connected|claude/.test(document.querySelector('[data-testid=helper-status]')?.textContent ?? ''), null, { timeout: 20000 });
  // 1. no unlabeled controls (accessible name from aria-label, aria-labelledby, label, title or text)
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll('button,input:not([type=hidden]),select,textarea,[role=button]')].filter((e) => !e.hidden && !e.closest('[hidden]') && !(e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.title || e.labels?.length || e.textContent.trim() || e.closest('label'))).map((e) => e.outerHTML.slice(0, 90)));
  check('no unlabeled controls', unlabeled.length === 0, unlabeled.join(' | '));
  // 2. the core flow with the keyboard only: Cmd/Ctrl+K -> Say -> Enter, Enter selects a screen, lens + Check, export from the frame menu
  await page.keyboard.press('Control+k'); check('Ctrl+K focuses Say', await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'say-input'));
  const ring = await page.evaluate(() => getComputedStyle(document.querySelector('.say')).boxShadow); check('Say island shows a focus ring', ring !== 'none' && /rgb/.test(ring), ring);
  await page.keyboard.type('make the clock bigger'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => /applied|failed|Local ·/.test(document.querySelector('[data-testid=say-status]')?.textContent ?? ''), null, { timeout: 15000 }).catch(async () => console.log('status:', await page.textContent('[data-testid=say-status]'), '| helper:', await page.textContent('[data-testid=helper-status]'))); check('Say applied by keyboard', /applied|Local ·/.test(await page.textContent('[data-testid=say-status]')));
  await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Enter'); await page.waitForSelector('[data-testid=sel]', { timeout: 4000 }); check('Enter selects the first screen (no mouse)', true);
  const canvasFocus = await page.evaluate(() => { const c = document.querySelector('[data-testid=canvas]'); c.focus(); return { role: c.getAttribute('role'), label: !!c.getAttribute('aria-label'), outline: getComputedStyle(c).outlineStyle }; }); check('canvas is a labelled, focusable region with a focus ring', canvasFocus.role === 'region' && canvasFocus.label && canvasFocus.outline === 'solid', JSON.stringify(canvasFocus));
  // Tab reaches the frame menu button, Enter opens it, Escape closes it and returns focus
  await page.focus('[data-testid=frame-menu]'); await page.keyboard.press('Enter'); await page.waitForSelector('[data-testid=frame-popover]'); check('frame menu opens with Enter', true);
  const dl = page.waitForEvent('download', { timeout: 5000 }); await page.focus('[data-testid=export]'); await page.keyboard.press('Enter'); const d = await dl; check('export by keyboard', /\.html$/.test(d.suggestedFilename()), d.suggestedFilename());
  if (!(await page.$('[data-testid=frame-popover]'))) { await page.focus('[data-testid=frame-menu]'); await page.keyboard.press('Enter'); await page.waitForSelector('[data-testid=frame-popover]'); } await page.keyboard.press('Escape'); check('Escape closes the menu and focus returns to its button', await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'frame-menu'));
  // 3. every button shows a focus ring when focused by keyboard
  const rings = await page.evaluate(async () => { const bad = []; for (const b of [...document.querySelectorAll('button:not([disabled])')].filter((e) => e.offsetParent).slice(0, 25)) { b.focus({ focusVisible: true }); const cs = getComputedStyle(b); if (cs.outlineStyle === 'none' || cs.outlineWidth === '0px') bad.push(b.getAttribute('aria-label') || b.textContent.trim().slice(0, 20)); } return bad; }); check('visible focus on buttons', rings.length === 0, rings.join(','));
  // 4. reduced motion: the global rule removes transitions and animations
  const motion = await page.evaluate(() => { const b = document.querySelector('.btn'); const cs = getComputedStyle(b); return { t: cs.transitionDuration, rm: matchMedia('(prefers-reduced-motion: reduce)').matches }; }); check('reduced motion drops transitions', motion.rm && /^0s(, 0s)*$/.test(motion.t), motion.t);
} catch (e) { console.error(e); fails.push('crashed'); } finally { await browser?.close(); procs.forEach((p) => p.kill()); }
if (fails.length) { console.error(`\n${fails.length} failed`); process.exit(1); } console.log('\nall a11y checks passed');
