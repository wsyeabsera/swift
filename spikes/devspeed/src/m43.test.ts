import { expect, test } from 'vitest';
import { make43, f43 } from './m43';
test('m43', () => { expect(f43(make43(50))).toBeGreaterThan(0); });
