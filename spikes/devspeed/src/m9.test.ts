import { expect, test } from 'vitest';
import { make9, f9 } from './m9';
test('m9', () => { expect(f9(make9(50))).toBeGreaterThan(0); });
