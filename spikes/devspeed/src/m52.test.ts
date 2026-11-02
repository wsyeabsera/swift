import { expect, test } from 'vitest';
import { make52, f52 } from './m52';
test('m52', () => { expect(f52(make52(50))).toBeGreaterThan(0); });
