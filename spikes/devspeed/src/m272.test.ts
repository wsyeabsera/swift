import { expect, test } from 'vitest';
import { make272, f272 } from './m272';
test('m272', () => { expect(f272(make272(50))).toBeGreaterThan(0); });
