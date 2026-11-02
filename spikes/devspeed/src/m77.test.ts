import { expect, test } from 'vitest';
import { make77, f77 } from './m77';
test('m77', () => { expect(f77(make77(50))).toBeGreaterThan(0); });
