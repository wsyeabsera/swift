import { expect, test } from 'vitest';
import { make273, f273 } from './m273';
test('m273', () => { expect(f273(make273(50))).toBeGreaterThan(0); });
