import { expect, test } from 'vitest';
import { make41, f41 } from './m41';
test('m41', () => { expect(f41(make41(50))).toBeGreaterThan(0); });
