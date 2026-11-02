import { expect, test } from 'vitest';
import { make257, f257 } from './m257';
test('m257', () => { expect(f257(make257(50))).toBeGreaterThan(0); });
