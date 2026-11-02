import { expect, test } from 'vitest';
import { make83, f83 } from './m83';
test('m83', () => { expect(f83(make83(50))).toBeGreaterThan(0); });
