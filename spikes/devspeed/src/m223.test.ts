import { expect, test } from 'vitest';
import { make223, f223 } from './m223';
test('m223', () => { expect(f223(make223(50))).toBeGreaterThan(0); });
