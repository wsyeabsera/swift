import { expect, test } from 'vitest';
import { make129, f129 } from './m129';
test('m129', () => { expect(f129(make129(50))).toBeGreaterThan(0); });
