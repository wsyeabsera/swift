import { expect, test } from 'vitest';
import { make7, f7 } from './m7';
test('m7', () => { expect(f7(make7(50))).toBeGreaterThan(0); });
