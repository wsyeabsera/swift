import { expect, test } from 'vitest';
import { make171, f171 } from './m171';
test('m171', () => { expect(f171(make171(50))).toBeGreaterThan(0); });
