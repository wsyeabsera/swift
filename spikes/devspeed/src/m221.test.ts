import { expect, test } from 'vitest';
import { make221, f221 } from './m221';
test('m221', () => { expect(f221(make221(50))).toBeGreaterThan(0); });
