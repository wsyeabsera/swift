import { expect, test } from 'vitest';
import { make203, f203 } from './m203';
test('m203', () => { expect(f203(make203(50))).toBeGreaterThan(0); });
