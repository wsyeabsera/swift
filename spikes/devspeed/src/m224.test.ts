import { expect, test } from 'vitest';
import { make224, f224 } from './m224';
test('m224', () => { expect(f224(make224(50))).toBeGreaterThan(0); });
