import { expect, test } from 'vitest';
import { make46, f46 } from './m46';
test('m46', () => { expect(f46(make46(50))).toBeGreaterThan(0); });
