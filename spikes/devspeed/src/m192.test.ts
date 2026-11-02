import { expect, test } from 'vitest';
import { make192, f192 } from './m192';
test('m192', () => { expect(f192(make192(50))).toBeGreaterThan(0); });
