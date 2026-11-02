import { expect, test } from 'vitest';
import { make34, f34 } from './m34';
test('m34', () => { expect(f34(make34(50))).toBeGreaterThan(0); });
