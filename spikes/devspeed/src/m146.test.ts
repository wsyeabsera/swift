import { expect, test } from 'vitest';
import { make146, f146 } from './m146';
test('m146', () => { expect(f146(make146(50))).toBeGreaterThan(0); });
