import { expect, test } from 'vitest';
import { make90, f90 } from './m90';
test('m90', () => { expect(f90(make90(50))).toBeGreaterThan(0); });
