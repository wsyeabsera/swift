import { expect, test } from 'vitest';
import { starterFrames } from './starter';
import { parseDoc } from '../doc';
test('uses the project tokens for background, text, accent, card and border', () => {
  const f = starterFrames('Research Radar', { '--bg': 'oklch(0.97 0.005 240)', '--fg': 'oklch(0.14 0.03 240)', '--card': '#fff', '--border': '#ddd', '--primary': '#123456', '--primary-fg': '#fff', '--muted-fg': '#667' })[0]!;
  expect(f.html).toContain('--bg:oklch(0.97 0.005 240)'); expect(f.html).toContain('background:var(--bg)'); expect(f.html).toContain('color:var(--fg)'); expect(f.html).toContain('background:var(--primary);color:var(--primary-fg)'); expect(f.html).toContain('border:1px solid var(--border)'); expect(f.html).toContain('Research Radar'); expect(f.root).toBe('screen');
});
test('no tokens: plain fallbacks, no var() references', () => { const f = starterFrames('x', {})[0]!; expect(f.html).not.toContain('var('); expect(f.html).toContain('#14151a'); });
test('the name is escaped and the result is a valid saved doc', () => { const f = starterFrames('<img onerror=1>"&', { '--ac': '#0a84ff' }); expect(f[0]!.html).not.toContain('<img'); expect(f[0]!.html).toContain('&lt;img onerror=1&gt;&quot;&amp;'); expect(parseDoc({ frames: f })).toEqual(f); expect(f[0]!.html).toContain('background:var(--ac)'); });
test('only 16 tokens are inlined', () => { const t = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`--t${i}`, '#000'])); expect((starterFrames('x', t)[0]!.html.match(/--t\d+:/g) ?? []).length).toBe(16); });
