import { expect, test } from 'vitest';
import { make11, f11 } from './m11';
test('m11', () => { expect(f11(make11(50))).toBeGreaterThan(0); });
