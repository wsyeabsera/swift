import { expect, test } from 'vitest';
import { make206, f206 } from './m206';
test('m206', () => { expect(f206(make206(50))).toBeGreaterThan(0); });
