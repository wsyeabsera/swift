import { expect, test } from 'vitest';
import { make289, f289 } from './m289';
test('m289', () => { expect(f289(make289(50))).toBeGreaterThan(0); });
