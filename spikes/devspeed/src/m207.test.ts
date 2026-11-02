import { expect, test } from 'vitest';
import { make207, f207 } from './m207';
test('m207', () => { expect(f207(make207(50))).toBeGreaterThan(0); });
