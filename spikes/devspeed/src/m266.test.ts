import { expect, test } from 'vitest';
import { make266, f266 } from './m266';
test('m266', () => { expect(f266(make266(50))).toBeGreaterThan(0); });
