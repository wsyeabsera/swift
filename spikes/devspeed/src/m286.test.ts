import { expect, test } from 'vitest';
import { make286, f286 } from './m286';
test('m286', () => { expect(f286(make286(50))).toBeGreaterThan(0); });
