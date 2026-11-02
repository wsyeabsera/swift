import { expect, test } from 'vitest';
import { make251, f251 } from './m251';
test('m251', () => { expect(f251(make251(50))).toBeGreaterThan(0); });
