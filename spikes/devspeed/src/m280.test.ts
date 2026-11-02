import { expect, test } from 'vitest';
import { make280, f280 } from './m280';
test('m280', () => { expect(f280(make280(50))).toBeGreaterThan(0); });
