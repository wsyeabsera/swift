import { expect, test } from 'vitest';
import { make82, f82 } from './m82';
test('m82', () => { expect(f82(make82(50))).toBeGreaterThan(0); });
