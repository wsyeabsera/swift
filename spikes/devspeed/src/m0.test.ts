import { expect, test } from 'vitest';
import { make0, f0 } from './m0';
test('m0', () => { expect(f0(make0(50))).toBeGreaterThan(0); });
