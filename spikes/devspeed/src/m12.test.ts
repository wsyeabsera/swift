import { expect, test } from 'vitest';
import { make12, f12 } from './m12';
test('m12', () => { expect(f12(make12(50))).toBeGreaterThan(0); });
