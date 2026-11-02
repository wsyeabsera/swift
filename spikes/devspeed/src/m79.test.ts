import { expect, test } from 'vitest';
import { make79, f79 } from './m79';
test('m79', () => { expect(f79(make79(50))).toBeGreaterThan(0); });
