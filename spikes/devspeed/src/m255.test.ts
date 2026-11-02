import { expect, test } from 'vitest';
import { make255, f255 } from './m255';
test('m255', () => { expect(f255(make255(50))).toBeGreaterThan(0); });
