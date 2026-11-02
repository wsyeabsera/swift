import { expect, test } from 'vitest';
import { make274, f274 } from './m274';
test('m274', () => { expect(f274(make274(50))).toBeGreaterThan(0); });
