import { expect, test } from 'vitest';
import { make230, f230 } from './m230';
test('m230', () => { expect(f230(make230(50))).toBeGreaterThan(0); });
