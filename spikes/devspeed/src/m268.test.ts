import { expect, test } from 'vitest';
import { make268, f268 } from './m268';
test('m268', () => { expect(f268(make268(50))).toBeGreaterThan(0); });
