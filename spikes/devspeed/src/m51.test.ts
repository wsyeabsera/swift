import { expect, test } from 'vitest';
import { make51, f51 } from './m51';
test('m51', () => { expect(f51(make51(50))).toBeGreaterThan(0); });
