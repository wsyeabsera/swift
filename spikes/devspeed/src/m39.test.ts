import { expect, test } from 'vitest';
import { make39, f39 } from './m39';
test('m39', () => { expect(f39(make39(50))).toBeGreaterThan(0); });
