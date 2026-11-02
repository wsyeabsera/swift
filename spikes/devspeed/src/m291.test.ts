import { expect, test } from 'vitest';
import { make291, f291 } from './m291';
test('m291', () => { expect(f291(make291(50))).toBeGreaterThan(0); });
