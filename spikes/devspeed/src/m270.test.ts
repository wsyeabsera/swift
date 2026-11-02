import { expect, test } from 'vitest';
import { make270, f270 } from './m270';
test('m270', () => { expect(f270(make270(50))).toBeGreaterThan(0); });
