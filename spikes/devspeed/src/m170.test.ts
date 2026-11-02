import { expect, test } from 'vitest';
import { make170, f170 } from './m170';
test('m170', () => { expect(f170(make170(50))).toBeGreaterThan(0); });
