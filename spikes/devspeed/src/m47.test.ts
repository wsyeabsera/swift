import { expect, test } from 'vitest';
import { make47, f47 } from './m47';
test('m47', () => { expect(f47(make47(50))).toBeGreaterThan(0); });
