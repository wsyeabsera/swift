import { expect, test } from 'vitest';
import { make220, f220 } from './m220';
test('m220', () => { expect(f220(make220(50))).toBeGreaterThan(0); });
