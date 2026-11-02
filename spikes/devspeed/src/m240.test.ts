import { expect, test } from 'vitest';
import { make240, f240 } from './m240';
test('m240', () => { expect(f240(make240(50))).toBeGreaterThan(0); });
