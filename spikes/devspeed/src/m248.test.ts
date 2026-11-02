import { expect, test } from 'vitest';
import { make248, f248 } from './m248';
test('m248', () => { expect(f248(make248(50))).toBeGreaterThan(0); });
