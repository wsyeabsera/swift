import { expect, test } from 'vitest';
import { make213, f213 } from './m213';
test('m213', () => { expect(f213(make213(50))).toBeGreaterThan(0); });
