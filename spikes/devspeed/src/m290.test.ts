import { expect, test } from 'vitest';
import { make290, f290 } from './m290';
test('m290', () => { expect(f290(make290(50))).toBeGreaterThan(0); });
