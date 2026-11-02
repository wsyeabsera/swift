import { expect, test } from 'vitest';
import { make279, f279 } from './m279';
test('m279', () => { expect(f279(make279(50))).toBeGreaterThan(0); });
