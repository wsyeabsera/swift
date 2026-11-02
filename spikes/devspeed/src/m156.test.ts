import { expect, test } from 'vitest';
import { make156, f156 } from './m156';
test('m156', () => { expect(f156(make156(50))).toBeGreaterThan(0); });
