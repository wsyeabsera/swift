import { expect, test } from 'vitest';
import { make247, f247 } from './m247';
test('m247', () => { expect(f247(make247(50))).toBeGreaterThan(0); });
