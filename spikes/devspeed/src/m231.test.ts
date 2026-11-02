import { expect, test } from 'vitest';
import { make231, f231 } from './m231';
test('m231', () => { expect(f231(make231(50))).toBeGreaterThan(0); });
