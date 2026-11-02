import { expect, test } from 'vitest';
import { make134, f134 } from './m134';
test('m134', () => { expect(f134(make134(50))).toBeGreaterThan(0); });
