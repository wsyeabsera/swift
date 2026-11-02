import { expect, test } from 'vitest';
import { make252, f252 } from './m252';
test('m252', () => { expect(f252(make252(50))).toBeGreaterThan(0); });
