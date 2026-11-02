import { expect, test } from 'vitest';
import { make209, f209 } from './m209';
test('m209', () => { expect(f209(make209(50))).toBeGreaterThan(0); });
