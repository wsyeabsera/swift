import { expect, test } from 'vitest';
import { make29, f29 } from './m29';
test('m29', () => { expect(f29(make29(50))).toBeGreaterThan(0); });
