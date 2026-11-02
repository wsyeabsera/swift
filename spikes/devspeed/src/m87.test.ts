import { expect, test } from 'vitest';
import { make87, f87 } from './m87';
test('m87', () => { expect(f87(make87(50))).toBeGreaterThan(0); });
