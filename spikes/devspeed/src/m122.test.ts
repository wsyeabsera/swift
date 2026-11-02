import { expect, test } from 'vitest';
import { make122, f122 } from './m122';
test('m122', () => { expect(f122(make122(50))).toBeGreaterThan(0); });
