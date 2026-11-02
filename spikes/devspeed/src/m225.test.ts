import { expect, test } from 'vitest';
import { make225, f225 } from './m225';
test('m225', () => { expect(f225(make225(50))).toBeGreaterThan(0); });
