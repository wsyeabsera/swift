import { expect, test } from 'vitest';
import { make98, f98 } from './m98';
test('m98', () => { expect(f98(make98(50))).toBeGreaterThan(0); });
