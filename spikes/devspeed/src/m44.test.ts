import { expect, test } from 'vitest';
import { make44, f44 } from './m44';
test('m44', () => { expect(f44(make44(50))).toBeGreaterThan(0); });
