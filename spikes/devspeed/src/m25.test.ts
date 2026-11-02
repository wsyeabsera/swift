import { expect, test } from 'vitest';
import { make25, f25 } from './m25';
test('m25', () => { expect(f25(make25(50))).toBeGreaterThan(0); });
