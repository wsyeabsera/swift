import { expect, test } from 'vitest';
import { make101, f101 } from './m101';
test('m101', () => { expect(f101(make101(50))).toBeGreaterThan(0); });
