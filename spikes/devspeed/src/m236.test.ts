import { expect, test } from 'vitest';
import { make236, f236 } from './m236';
test('m236', () => { expect(f236(make236(50))).toBeGreaterThan(0); });
