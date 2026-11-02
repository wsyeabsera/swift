import { expect, test } from 'vitest';
import { make276, f276 } from './m276';
test('m276', () => { expect(f276(make276(50))).toBeGreaterThan(0); });
