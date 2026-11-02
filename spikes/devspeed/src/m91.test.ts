import { expect, test } from 'vitest';
import { make91, f91 } from './m91';
test('m91', () => { expect(f91(make91(50))).toBeGreaterThan(0); });
