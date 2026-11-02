import { expect, test } from 'vitest';
import { make292, f292 } from './m292';
test('m292', () => { expect(f292(make292(50))).toBeGreaterThan(0); });
