import { expect, test } from 'vitest';
import { make281, f281 } from './m281';
test('m281', () => { expect(f281(make281(50))).toBeGreaterThan(0); });
