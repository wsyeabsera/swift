import { expect, test } from 'vitest';
import { make10, f10 } from './m10';
test('m10', () => { expect(f10(make10(50))).toBeGreaterThan(0); });
