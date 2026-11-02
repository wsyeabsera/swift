import { expect, test } from 'vitest';
import { make116, f116 } from './m116';
test('m116', () => { expect(f116(make116(50))).toBeGreaterThan(0); });
