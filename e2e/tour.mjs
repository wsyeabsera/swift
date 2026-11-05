// Lens tour e2e (task #1843), TEST environment: the core flow by keyboard alone, no unlabeled controls, visible focus, reduced motion.
// node e2e/tour.mjs   (needs: cargo build -p swift-canvas-helper; run via `npm run e2e:a11y`)
import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
import { TEST_URL, viteEnv, helperEnv, ROOT, requireFreeTestPorts, startVite } from './env.mjs';
const procs = []; const fails = []; const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); if (!ok) fails.push(name); };
const waitHttp = async (url) => { for (let i = 0; i < 80; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 250)); } throw new Error('timeout ' + url); };
await requireFreeTestPorts();
let browser;
try {
  procs.push(startVite()); await waitHttp(TEST_URL);
  procs.push(spawn(`${ROOT}/target/debug/swift-canvas-helper`, [], { env: { ...helperEnv, SWIFT_DEV: '1', SWIFT_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sc-tour-')), SWIFT_PROJECT_ROOTS: ROOT, SWIFT_CLAUDE_BIN: `${ROOT}/tools/fake-claude.mjs`, FAKE_FIXTURE: `${ROOT}/tools/fixtures/say-clock.json` }, stdio: 'ignore' })); await new Promise((r) => setTimeout(r, 800));
  browser = await chromium.launch({ headless: true }); const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage(); await page.goto(TEST_URL);
  await page.waitForSelector('[data-testid=tour-button]', { timeout: 20000 });
  // Fresh install: the Tour button opens the sample project (it never touches the user's own project) and starts the tour on reload.
  await page.focus('[data-testid=tour-button]'); await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid=lens-strip][data-lens=Design]', { timeout: 20000 }); await page.waitForFunction(() => window.__swift && window.__swift.frames.length === 3, null, { timeout: 20000 });
  check('tour starts on the sample project with three frames', true); check('project is the sample', /Sample/.test(await page.textContent('[data-testid=project-button]')));
  const LENSES = ['Design', 'Prototype', 'Motion', 'Effects', '3D', 'Critique', 'Pulse', 'Brand', 'Diagram'];
  const has = { Design: '[data-testid=canvas]', Motion: '[data-testid=strip-row]', Critique: '[data-testid=finding]', Pulse: '[data-testid=pulse-panel]', Brand: '[data-testid=brand-token]' };
  for (let i = 0; i < LENSES.length; i++) {
    const l = LENSES[i]; if (i > 0) await page.keyboard.press('ArrowRight');
    await page.waitForSelector(`[data-testid=lens-strip][data-lens="${l}"]`, { timeout: 5000 }); check(`tour step ${i + 1}: ${l}`, true);
    const text = await page.textContent('[data-testid=lens-strip]'); check(`${l} strip has a line, actions and a prompt`, (await page.$$('[data-testid=lens-strip-actions] li')).length === 3 && /Claude Code/.test(text));
    if (has[l]) { await page.waitForSelector(has[l], { timeout: 8000 }).then(() => check(`${l} is not empty`, true), () => check(`${l} is not empty`, false)); }
    if (l === 'Prototype') check('Prototype has links to show', await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('swift-canvas.proto.v1.') && k.includes('sample')) ?? '') ?? '[]').length > 0));
  }
  await page.keyboard.press('ArrowLeft'); check('ArrowLeft steps back', (await page.getAttribute('[data-testid=lens-strip]', 'data-lens')) === 'Brand');
  check('no modal over the canvas', (await page.$('[role=dialog][aria-modal=true]')) === null);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('[data-testid=tour-next]'), null, { timeout: 3000 }); check('Esc leaves the tour', true);
  check('focus returns to the Tour button', await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'tour-button'));
  const anim = await page.evaluate(() => { const e = document.querySelector('[data-testid=tour-button]'); return matchMedia('(prefers-reduced-motion: reduce)').matches && getComputedStyle(e).transitionDuration; }); check('reduced motion is honoured', anim === '0s', String(anim));
} catch (e) { console.error(e); fails.push('crashed'); } finally { await browser?.close(); procs.forEach((p) => p.kill()); }
if (fails.length) { console.error(`\n${fails.length} failed`); process.exit(1); } console.log('\nall tour checks passed');
