import { expect, test } from 'vitest';
import { make1, f1 } from './m1';
test('m1', () => { expect(f1(make1(50))).toBeGreaterThan(0); });
