import { expect, test } from 'vitest';
import { make66, f66 } from './m66';
test('m66', () => { expect(f66(make66(50))).toBeGreaterThan(0); });
