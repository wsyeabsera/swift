import { expect, test } from 'vitest';
import { make168, f168 } from './m168';
test('m168', () => { expect(f168(make168(50))).toBeGreaterThan(0); });
