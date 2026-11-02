import { expect, test } from 'vitest';
import { make15, f15 } from './m15';
test('m15', () => { expect(f15(make15(50))).toBeGreaterThan(0); });
