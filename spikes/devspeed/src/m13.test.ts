import { expect, test } from 'vitest';
import { make13, f13 } from './m13';
test('m13', () => { expect(f13(make13(50))).toBeGreaterThan(0); });
