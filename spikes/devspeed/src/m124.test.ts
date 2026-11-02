import { expect, test } from 'vitest';
import { make124, f124 } from './m124';
test('m124', () => { expect(f124(make124(50))).toBeGreaterThan(0); });
