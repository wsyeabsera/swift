import { expect, test } from 'vitest';
import { make298, f298 } from './m298';
test('m298', () => { expect(f298(make298(50))).toBeGreaterThan(0); });
