import { expect, test } from 'vitest';
import { make8, f8 } from './m8';
test('m8', () => { expect(f8(make8(50))).toBeGreaterThan(0); });
