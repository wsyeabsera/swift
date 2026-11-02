import { expect, test } from 'vitest';
import { make49, f49 } from './m49';
test('m49', () => { expect(f49(make49(50))).toBeGreaterThan(0); });
