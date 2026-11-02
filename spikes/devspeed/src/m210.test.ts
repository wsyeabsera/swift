import { expect, test } from 'vitest';
import { make210, f210 } from './m210';
test('m210', () => { expect(f210(make210(50))).toBeGreaterThan(0); });
