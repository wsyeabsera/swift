import { expect, test } from 'vitest';
import { make2, f2 } from './m2';
test('m2', () => { expect(f2(make2(50))).toBeGreaterThan(0); });
