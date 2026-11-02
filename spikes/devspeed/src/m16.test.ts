import { expect, test } from 'vitest';
import { make16, f16 } from './m16';
test('m16', () => { expect(f16(make16(50))).toBeGreaterThan(0); });
