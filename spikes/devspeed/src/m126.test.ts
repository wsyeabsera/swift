import { expect, test } from 'vitest';
import { make126, f126 } from './m126';
test('m126', () => { expect(f126(make126(50))).toBeGreaterThan(0); });
