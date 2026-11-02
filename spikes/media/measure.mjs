import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const { chromium } = require('/Users/yab/.nvm/versions/node/v24.20.0/lib/node_modules/playwright-core'); import path from 'node:path';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: false, args: ['--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const p = await b.newPage(); await p.goto('file://' + path.resolve('index.html'));
for (const hw of ['prefer-hardware', 'prefer-software']) console.log(JSON.stringify(await p.evaluate(([f, r, h]) => window.run(f, r, h), [300, 60, hw])));
await b.close();
