import { expect, test } from 'vitest';
import { make130, f130 } from './m130';
test('m130', () => { expect(f130(make130(50))).toBeGreaterThan(0); });
