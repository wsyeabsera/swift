import { expect, test } from 'vitest';
import { make271, f271 } from './m271';
test('m271', () => { expect(f271(make271(50))).toBeGreaterThan(0); });
