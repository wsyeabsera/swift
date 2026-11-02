import { expect, test } from 'vitest';
import { make19, f19 } from './m19';
test('m19', () => { expect(f19(make19(50))).toBeGreaterThan(0); });
