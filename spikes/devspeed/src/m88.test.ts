import { expect, test } from 'vitest';
import { make88, f88 } from './m88';
test('m88', () => { expect(f88(make88(50))).toBeGreaterThan(0); });
