import { expect, test } from 'vitest';
import { make261, f261 } from './m261';
test('m261', () => { expect(f261(make261(50))).toBeGreaterThan(0); });
