import { expect, test } from 'vitest';
import { make93, f93 } from './m93';
test('m93', () => { expect(f93(make93(50))).toBeGreaterThan(0); });
