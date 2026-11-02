import { expect, test } from 'vitest';
import { make70, f70 } from './m70';
test('m70', () => { expect(f70(make70(50))).toBeGreaterThan(0); });
