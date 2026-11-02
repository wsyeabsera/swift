import { expect, test } from 'vitest';
import { make45, f45 } from './m45';
test('m45', () => { expect(f45(make45(50))).toBeGreaterThan(0); });
