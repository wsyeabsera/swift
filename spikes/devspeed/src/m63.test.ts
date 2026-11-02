import { expect, test } from 'vitest';
import { make63, f63 } from './m63';
test('m63', () => { expect(f63(make63(50))).toBeGreaterThan(0); });
