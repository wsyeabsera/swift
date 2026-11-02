import { expect, test } from 'vitest';
import { make161, f161 } from './m161';
test('m161', () => { expect(f161(make161(50))).toBeGreaterThan(0); });
