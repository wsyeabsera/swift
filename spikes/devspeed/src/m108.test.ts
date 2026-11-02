import { expect, test } from 'vitest';
import { make108, f108 } from './m108';
test('m108', () => { expect(f108(make108(50))).toBeGreaterThan(0); });
