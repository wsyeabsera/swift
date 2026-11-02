import { expect, test } from 'vitest';
import { make241, f241 } from './m241';
test('m241', () => { expect(f241(make241(50))).toBeGreaterThan(0); });
