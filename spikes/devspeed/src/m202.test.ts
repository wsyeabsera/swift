import { expect, test } from 'vitest';
import { make202, f202 } from './m202';
test('m202', () => { expect(f202(make202(50))).toBeGreaterThan(0); });
