import { expect, test } from 'vitest';
import { make250, f250 } from './m250';
test('m250', () => { expect(f250(make250(50))).toBeGreaterThan(0); });
