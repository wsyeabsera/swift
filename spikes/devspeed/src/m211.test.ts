import { expect, test } from 'vitest';
import { make211, f211 } from './m211';
test('m211', () => { expect(f211(make211(50))).toBeGreaterThan(0); });
