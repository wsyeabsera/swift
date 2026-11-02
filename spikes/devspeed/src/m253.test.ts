import { expect, test } from 'vitest';
import { make253, f253 } from './m253';
test('m253', () => { expect(f253(make253(50))).toBeGreaterThan(0); });
