import { expect, test } from 'vitest';
import { make33, f33 } from './m33';
test('m33', () => { expect(f33(make33(50))).toBeGreaterThan(0); });
