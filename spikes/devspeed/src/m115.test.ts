import { expect, test } from 'vitest';
import { make115, f115 } from './m115';
test('m115', () => { expect(f115(make115(50))).toBeGreaterThan(0); });
