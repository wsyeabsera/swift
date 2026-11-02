import { chromium } from 'playwright-core'; import { spawn } from 'node:child_process'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const v = spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:5173/')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5173/'); await p.waitForFunction(() => window.__theme && window.__swift); await p.evaluate((bd) => window.__theme.set({ bd, mode: 'auto', glass: 'regular' }), process.argv[2] ?? 'fuji'); await p.waitForTimeout(500);
await p.getByTestId('appearance-button').click(); await p.waitForTimeout(700); await p.screenshot({ path: `${root}/e2e/shot-theme.png` }); await b.close(); v.kill(); process.exit(0);
