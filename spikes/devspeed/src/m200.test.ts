import { expect, test } from 'vitest';
import { make200, f200 } from './m200';
test('m200', () => { expect(f200(make200(50))).toBeGreaterThan(0); });
