import { expect, test } from 'vitest';
import { make256, f256 } from './m256';
test('m256', () => { expect(f256(make256(50))).toBeGreaterThan(0); });
