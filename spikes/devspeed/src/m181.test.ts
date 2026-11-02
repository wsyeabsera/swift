import { expect, test } from 'vitest';
import { make181, f181 } from './m181';
test('m181', () => { expect(f181(make181(50))).toBeGreaterThan(0); });
