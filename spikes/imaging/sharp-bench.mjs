import sharp from 'sharp'; import { performance } from 'node:perf_hooks'; import fs from 'node:fs';
if (!fs.existsSync('test8k.jpg')) await sharp(process.env.HOME + '/Hobby/swift-canvas-design/bg/lake.jpg').resize(7680, 4320, { fit: 'cover' }).modulate({ brightness: 1 }).jpeg({ quality: 90 }).toFile('test8k.jpg');
fs.mkdirSync('out', { recursive: true });
const run = async () => { const t0 = performance.now(); const widths = [1920, 960, 480]; let first = 0;
  for (const [i, w] of widths.entries()) { await sharp('test8k.jpg').resize(w).jpeg({ quality: 80 }).toFile(`out/sharp-${w}.jpg`); if (i === 0) first = performance.now() - t0; }
  // tiles: 512px tiles of a 3840-wide level (15 x 5 ~ 8x5 tiles), the level a zoomed 8K view would show
  const t1 = performance.now(); await sharp('test8k.jpg').resize(3840).jpeg({ quality: 80 }).tile({ size: 512, layout: 'google' }).toFile('out/tiles').catch(() => {}); const tiles = performance.now() - t1;
  return { firstPreviewMs: Math.round(first), pyramidMs: Math.round(performance.now() - t0 - tiles), tilesMs: Math.round(tiles) }; };
await run(); const r = []; for (let i = 0; i < 3; i++) r.push(await run()); console.log('sharp', JSON.stringify(r));
