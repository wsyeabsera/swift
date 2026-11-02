import { expect, test } from 'vitest';
import { make117, f117 } from './m117';
test('m117', () => { expect(f117(make117(50))).toBeGreaterThan(0); });
