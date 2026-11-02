import { expect, test } from 'vitest';
import { make193, f193 } from './m193';
test('m193', () => { expect(f193(make193(50))).toBeGreaterThan(0); });
