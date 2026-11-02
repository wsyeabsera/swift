import { expect, test } from 'vitest';
import { make218, f218 } from './m218';
test('m218', () => { expect(f218(make218(50))).toBeGreaterThan(0); });
