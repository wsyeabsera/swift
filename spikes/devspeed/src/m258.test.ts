import { expect, test } from 'vitest';
import { make258, f258 } from './m258';
test('m258', () => { expect(f258(make258(50))).toBeGreaterThan(0); });
