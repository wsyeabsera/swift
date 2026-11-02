import { expect, test } from 'vitest';
import { make31, f31 } from './m31';
test('m31', () => { expect(f31(make31(50))).toBeGreaterThan(0); });
