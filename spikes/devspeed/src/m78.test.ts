import { expect, test } from 'vitest';
import { make78, f78 } from './m78';
test('m78', () => { expect(f78(make78(50))).toBeGreaterThan(0); });
