import { expect, test } from 'vitest';
import { make56, f56 } from './m56';
test('m56', () => { expect(f56(make56(50))).toBeGreaterThan(0); });
