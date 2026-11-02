import { expect, test } from 'vitest';
import { make4, f4 } from './m4';
test('m4', () => { expect(f4(make4(50))).toBeGreaterThan(0); });
