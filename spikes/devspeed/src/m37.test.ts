import { expect, test } from 'vitest';
import { make37, f37 } from './m37';
test('m37', () => { expect(f37(make37(50))).toBeGreaterThan(0); });
