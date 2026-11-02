import { expect, test } from 'vitest';
import { clampScale, fit, isVisible, MAX_S, MIN_S, panBy, screenToWorld, zoomAt } from './viewport';
const v = { x: 100, y: 50, s: 1 };
test('zoomAt keeps the point under the cursor fixed', () => {
  const before = screenToWorld(v, 400, 300); const z = zoomAt(v, 400, 300, 2); const after = screenToWorld(z, 400, 300);
  expect(z.s).toBe(2); expect(after.x).toBeCloseTo(before.x); expect(after.y).toBeCloseTo(before.y);
});
test('scale is clamped both ways', () => { expect(clampScale(100)).toBe(MAX_S); expect(clampScale(0.0001)).toBe(MIN_S); expect(zoomAt(v, 0, 0, 1e9).s).toBe(MAX_S); });
test('panBy moves only x and y', () => { expect(panBy(v, 5, -7)).toEqual({ x: 105, y: 43, s: 1 }); });
test('visibility: inside, outside, and the margin', () => {
  const f = { x: 0, y: 0, w: 100, h: 100 };
  expect(isVisible(f, { x: 10, y: 10, s: 1 }, 800, 600)).toBe(true);
  expect(isVisible(f, { x: 900, y: 10, s: 1 }, 800, 600)).toBe(false);
  expect(isVisible(f, { x: 850, y: 10, s: 1 }, 800, 600, 100)).toBe(true);
  expect(isVisible(f, { x: -101, y: 10, s: 1 }, 800, 600)).toBe(false);
});
test('fit puts all rects inside the viewport', () => {
  const rects = [{ x: 0, y: 0, w: 1920, h: 1080 }, { x: 2100, y: 0, w: 390, h: 844 }]; const view = fit(rects, 1440, 800);
  for (const r of rects) expect(isVisible(r, view, 1440, 800)).toBe(true);
  expect(fit([], 100, 100)).toEqual({ x: 0, y: 0, s: 1 });
});
