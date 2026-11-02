import { expect, test } from 'vitest';
import { make68, f68 } from './m68';
test('m68', () => { expect(f68(make68(50))).toBeGreaterThan(0); });
