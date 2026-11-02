import { expect, test } from 'vitest';
import { helperUrl, parseHello } from './helper';
test('url carries the token, encoded', () => { expect(helperUrl('a b')).toBe('ws://127.0.0.1:7431/?token=a%20b'); });
test('hello parses to connected with claude status', () => { expect(parseHello('{"type":"hello","claude":"ready","version":"0.0.1"}')).toEqual({ status: 'connected', claude: 'ready', version: '0.0.1' }); });
test('anything else is ignored, not thrown', () => { expect(parseHello('nope')).toBeNull(); expect(parseHello('{"type":"x"}')).toBeNull(); });
