import { expect, test } from 'vitest';
import { make198, f198 } from './m198';
test('m198', () => { expect(f198(make198(50))).toBeGreaterThan(0); });
