import { expect, test } from 'vitest';
import { make28, f28 } from './m28';
test('m28', () => { expect(f28(make28(50))).toBeGreaterThan(0); });
