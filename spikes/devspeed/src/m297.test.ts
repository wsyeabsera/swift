import { expect, test } from 'vitest';
import { make297, f297 } from './m297';
test('m297', () => { expect(f297(make297(50))).toBeGreaterThan(0); });
