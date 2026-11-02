import { expect, test } from 'vitest';
import { make287, f287 } from './m287';
test('m287', () => { expect(f287(make287(50))).toBeGreaterThan(0); });
