import { expect, test } from 'vitest';
import { make50, f50 } from './m50';
test('m50', () => { expect(f50(make50(50))).toBeGreaterThan(0); });
