import { expect, test } from 'vitest';
import { make48, f48 } from './m48';
test('m48', () => { expect(f48(make48(50))).toBeGreaterThan(0); });
