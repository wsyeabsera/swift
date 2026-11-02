import { expect, test } from 'vitest';
import { make92, f92 } from './m92';
test('m92', () => { expect(f92(make92(50))).toBeGreaterThan(0); });
