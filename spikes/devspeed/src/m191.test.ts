import { expect, test } from 'vitest';
import { make191, f191 } from './m191';
test('m191', () => { expect(f191(make191(50))).toBeGreaterThan(0); });
