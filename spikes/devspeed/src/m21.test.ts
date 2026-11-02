import { expect, test } from 'vitest';
import { make21, f21 } from './m21';
test('m21', () => { expect(f21(make21(50))).toBeGreaterThan(0); });
