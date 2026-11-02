import { expect, test } from 'vitest';
import { make144, f144 } from './m144';
test('m144', () => { expect(f144(make144(50))).toBeGreaterThan(0); });
