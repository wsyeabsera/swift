import { expect, test } from 'vitest';
import { make20, f20 } from './m20';
test('m20', () => { expect(f20(make20(50))).toBeGreaterThan(0); });
