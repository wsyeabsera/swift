import { expect, test } from 'vitest';
import { make153, f153 } from './m153';
test('m153', () => { expect(f153(make153(50))).toBeGreaterThan(0); });
