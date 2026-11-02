import { expect, test } from 'vitest';
import { make36, f36 } from './m36';
test('m36', () => { expect(f36(make36(50))).toBeGreaterThan(0); });
