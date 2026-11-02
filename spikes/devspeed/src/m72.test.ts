import { expect, test } from 'vitest';
import { make72, f72 } from './m72';
test('m72', () => { expect(f72(make72(50))).toBeGreaterThan(0); });
