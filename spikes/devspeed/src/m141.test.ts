import { expect, test } from 'vitest';
import { make141, f141 } from './m141';
test('m141', () => { expect(f141(make141(50))).toBeGreaterThan(0); });
