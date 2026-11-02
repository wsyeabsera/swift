import { expect, test } from 'vitest';
import { make143, f143 } from './m143';
test('m143', () => { expect(f143(make143(50))).toBeGreaterThan(0); });
