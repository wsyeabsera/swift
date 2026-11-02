import { expect, test } from 'vitest';
import { make267, f267 } from './m267';
test('m267', () => { expect(f267(make267(50))).toBeGreaterThan(0); });
