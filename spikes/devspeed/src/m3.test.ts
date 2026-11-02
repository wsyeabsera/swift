import { expect, test } from 'vitest';
import { make3, f3 } from './m3';
test('m3', () => { expect(f3(make3(50))).toBeGreaterThan(0); });
