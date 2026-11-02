import { expect, test } from 'vitest';
import { make22, f22 } from './m22';
test('m22', () => { expect(f22(make22(50))).toBeGreaterThan(0); });
