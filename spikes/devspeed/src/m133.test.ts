import { expect, test } from 'vitest';
import { make133, f133 } from './m133';
test('m133', () => { expect(f133(make133(50))).toBeGreaterThan(0); });
