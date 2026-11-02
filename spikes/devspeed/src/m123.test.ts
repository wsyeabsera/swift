import { expect, test } from 'vitest';
import { make123, f123 } from './m123';
test('m123', () => { expect(f123(make123(50))).toBeGreaterThan(0); });
