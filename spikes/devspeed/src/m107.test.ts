import { expect, test } from 'vitest';
import { make107, f107 } from './m107';
test('m107', () => { expect(f107(make107(50))).toBeGreaterThan(0); });
