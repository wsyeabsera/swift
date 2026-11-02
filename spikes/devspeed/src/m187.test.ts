import { expect, test } from 'vitest';
import { make187, f187 } from './m187';
test('m187', () => { expect(f187(make187(50))).toBeGreaterThan(0); });
