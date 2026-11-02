import { expect, test } from 'vitest';
import { make285, f285 } from './m285';
test('m285', () => { expect(f285(make285(50))).toBeGreaterThan(0); });
