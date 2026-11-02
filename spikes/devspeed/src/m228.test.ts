import { expect, test } from 'vitest';
import { make228, f228 } from './m228';
test('m228', () => { expect(f228(make228(50))).toBeGreaterThan(0); });
