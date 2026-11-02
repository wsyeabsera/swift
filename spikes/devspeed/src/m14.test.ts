import { expect, test } from 'vitest';
import { make14, f14 } from './m14';
test('m14', () => { expect(f14(make14(50))).toBeGreaterThan(0); });
