import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; const require = createRequire(import.meta.url);
const { chromium } = require('/Users/yab/.nvm/versions/node/v24.20.0/lib/node_modules/playwright-core');
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); await p.goto('file://' + path.resolve('dom-frame.html')); await p.waitForTimeout(400);
const cdp = await p.context().newCDPSession(p); await p.evaluate(() => document.getAnimations().forEach(a => { a.pause(); a.currentTime = 3000; }));
const d = (await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 85, clip: { x: 900, y: 0, width: 1020, height: 700, scale: 0.7 } })).data; fs.writeFileSync('frame-t3000.jpg', Buffer.from(d, 'base64')); await b.close();
