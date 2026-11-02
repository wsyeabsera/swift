import { expect, test } from 'vitest';
import { make85, f85 } from './m85';
test('m85', () => { expect(f85(make85(50))).toBeGreaterThan(0); });
