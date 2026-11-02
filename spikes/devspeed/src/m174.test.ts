import { expect, test } from 'vitest';
import { make174, f174 } from './m174';
test('m174', () => { expect(f174(make174(50))).toBeGreaterThan(0); });
