import { expect, test } from 'vitest';
import { make150, f150 } from './m150';
test('m150', () => { expect(f150(make150(50))).toBeGreaterThan(0); });
