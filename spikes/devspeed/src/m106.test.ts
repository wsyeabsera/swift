import { expect, test } from 'vitest';
import { make106, f106 } from './m106';
test('m106', () => { expect(f106(make106(50))).toBeGreaterThan(0); });
