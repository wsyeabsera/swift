import { expect, test } from 'vitest';
import { make17, f17 } from './m17';
test('m17', () => { expect(f17(make17(50))).toBeGreaterThan(0); });
