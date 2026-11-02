import { expect, test } from 'vitest';
import { make111, f111 } from './m111';
test('m111', () => { expect(f111(make111(50))).toBeGreaterThan(0); });
