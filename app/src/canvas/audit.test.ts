import { expect, test } from 'vitest';
import { auditFacts, contrastRatio } from './audit';
import type { AuditNode } from './bridge';
const node = (o: Partial<AuditNode>): AuditNode => ({ id: 'a', tag: 'div', text: 'Hello', x: 0, y: 0, w: 100, h: 40, fs: 30, color: { r: 255, g: 255, b: 255, a: 1 }, bg: { r: 20, g: 21, b: 26, image: false }, clipX: false, clipY: false, interactive: false, ...o });
const run = (n: Partial<AuditNode>, s: 'tv' | 'phone' | 'desktop' = 'tv') => auditFacts({ w: 1920, h: 1080, nodes: [node(n)] }, s);
test('contrast ratio matches the WCAG reference values', () => { expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 0); expect(contrastRatio({ r: 119, g: 119, b: 119 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(4.48, 1); });
test('a clean node has no findings', () => expect(run({})).toEqual([]));
test('low contrast is found with a readable colour as the fix; large text needs only 3:1', () => {
  const f = run({ fs: 16, color: { r: 90, g: 90, b: 100, a: 1 } }, 'phone'); expect(f[0]).toMatchObject({ kind: 'contrast', fix: { prop: 'color', value: '#ffffff' } });
  expect(run({ fs: 30, color: { r: 120, g: 120, b: 130, a: 1 } })).toEqual([]); // ~4.5:1 on dark bg, large text passes
});
test('translucent text is judged on the colour it actually shows', () => expect(run({ fs: 16, color: { r: 255, g: 255, b: 255, a: 0.15 } }, 'phone')[0]?.kind).toBe('contrast'));
test('a background image is not guessed at', () => expect(run({ color: { r: 20, g: 21, b: 26, a: 1 }, bg: { r: 20, g: 21, b: 26, image: true } })).toEqual([]));
test('clipped and off-frame text', () => { expect(run({ clipX: true })[0]?.kind).toBe('clipped'); expect(run({ x: 2000 })[0]?.kind).toBe('offscreen'); });
test('tap targets: phone 44px, desktop 24px, TV none', () => {
  expect(run({ text: '', interactive: true, w: 30, h: 30 }, 'phone')[0]).toMatchObject({ kind: 'tap', fix: { prop: 'min-height', value: '44px' } });
  expect(run({ text: '', interactive: true, w: 30, h: 30 }, 'desktop')).toEqual([]); expect(run({ text: '', interactive: true, w: 10, h: 10 }, 'tv')).toEqual([]);
});
test('10-foot legibility only applies to TV frames', () => { expect(run({ fs: 18 })[0]).toMatchObject({ kind: 'legibility', fix: { value: '24px' } }); expect(run({ fs: 18 }, 'phone')).toEqual([]); });
