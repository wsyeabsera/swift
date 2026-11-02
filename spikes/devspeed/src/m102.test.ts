import { expect, test } from 'vitest';
import { make102, f102 } from './m102';
test('m102', () => { expect(f102(make102(50))).toBeGreaterThan(0); });
