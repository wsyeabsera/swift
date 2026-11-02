import { expect, test } from 'vitest';
import { make76, f76 } from './m76';
test('m76', () => { expect(f76(make76(50))).toBeGreaterThan(0); });
