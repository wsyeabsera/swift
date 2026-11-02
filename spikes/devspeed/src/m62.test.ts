import { expect, test } from 'vitest';
import { make62, f62 } from './m62';
test('m62', () => { expect(f62(make62(50))).toBeGreaterThan(0); });
