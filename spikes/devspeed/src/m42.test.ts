import { expect, test } from 'vitest';
import { make42, f42 } from './m42';
test('m42', () => { expect(f42(make42(50))).toBeGreaterThan(0); });
