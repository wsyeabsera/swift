import { expect, test } from 'vitest';
import { make172, f172 } from './m172';
test('m172', () => { expect(f172(make172(50))).toBeGreaterThan(0); });
