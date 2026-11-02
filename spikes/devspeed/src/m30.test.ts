import { expect, test } from 'vitest';
import { make30, f30 } from './m30';
test('m30', () => { expect(f30(make30(50))).toBeGreaterThan(0); });
