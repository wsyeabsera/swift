import { expect, test } from 'vitest';
import { make65, f65 } from './m65';
test('m65', () => { expect(f65(make65(50))).toBeGreaterThan(0); });
