import { expect, test } from 'vitest';
import { make105, f105 } from './m105';
test('m105', () => { expect(f105(make105(50))).toBeGreaterThan(0); });
