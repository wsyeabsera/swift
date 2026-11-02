import { expect, test } from 'vitest';
import { make38, f38 } from './m38';
test('m38', () => { expect(f38(make38(50))).toBeGreaterThan(0); });
