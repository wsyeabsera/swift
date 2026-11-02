import { expect, test } from 'vitest';
import { make5, f5 } from './m5';
test('m5', () => { expect(f5(make5(50))).toBeGreaterThan(0); });
