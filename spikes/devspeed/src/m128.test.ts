import { expect, test } from 'vitest';
import { make128, f128 } from './m128';
test('m128', () => { expect(f128(make128(50))).toBeGreaterThan(0); });
