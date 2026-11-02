import { expect, test } from 'vitest';
import { make113, f113 } from './m113';
test('m113', () => { expect(f113(make113(50))).toBeGreaterThan(0); });
