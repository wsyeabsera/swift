import { expect, test } from 'vitest';
import { make263, f263 } from './m263';
test('m263', () => { expect(f263(make263(50))).toBeGreaterThan(0); });
