import { expect, test } from 'vitest';
import { make135, f135 } from './m135';
test('m135', () => { expect(f135(make135(50))).toBeGreaterThan(0); });
