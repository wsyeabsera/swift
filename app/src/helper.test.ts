import { describe, expect, test, it } from 'vitest';
import { helperUrl, parseClaudeStatus, parseHello, parsePickReply, parseStoreReply, parseSayEvent } from './helper';
test('url carries the token, encoded', () => { expect(helperUrl('a b')).toBe('ws://127.0.0.1:7431/?token=a%20b'); });
test('hello parses to connected with claude status', () => { expect(parseHello('{"type":"hello","claude":"ready","version":"0.0.1"}')).toEqual({ status: 'connected', claude: 'ready', version: '0.0.1' }); });
test('anything else is ignored, not thrown', () => { expect(parseHello('nope')).toBeNull(); expect(parseHello('{"type":"x"}')).toBeNull(); });
test('store replies parse: data, missing project, errors, junk', () => {
  expect(parseStoreReply('{"type":"store.get","id":"t1","ok":true,"data":"{}"}')).toEqual({ id: 't1', result: { ok: true, data: '{}' } }); expect(parseStoreReply('{"type":"store.get","id":"t1","ok":true,"data":null}')).toEqual({ id: 't1', result: { ok: true, data: null } });
  expect(parseStoreReply('{"type":"store.put","id":"t2","ok":false,"error":"bad project id"}')).toEqual({ id: 't2', result: { ok: false, error: 'bad project id' } }); expect(parseStoreReply('{"type":"say.event","id":"x"}')).toBeNull(); expect(parseStoreReply('nope')).toBeNull();
});
test('pick replies parse: path, cancel, junk', () => {
  expect(parsePickReply('{"type":"project.pick","id":"k1","ok":true,"path":"/a/b/"}')).toEqual({ id: 'k1', result: { ok: true, path: '/a/b/' } }); expect(parsePickReply('{"type":"project.pick","id":"k1","ok":false,"error":"cancelled"}')).toEqual({ id: 'k1', result: { ok: false, error: 'cancelled' } });
  expect(parsePickReply('{"type":"project.pick","id":"k1","ok":true}')).toEqual({ id: 'k1', result: { ok: false, error: 'no folder chosen' } }); expect(parsePickReply('{"type":"project.scan","id":"k1"}')).toBeNull(); expect(parsePickReply('x')).toBeNull();
});
test('hello carries the typed claude status; old hellos still parse', () => {
  expect(parseHello('{"type":"hello","claude":"ready (1)","claudeStatus":{"state":"logged_out","message":"m"}}')).toEqual({ status: 'connected', claude: 'ready (1)', claudeStatus: { state: 'logged_out', message: 'm' } });
  expect(parseHello('{"type":"hello","claude":"missing","claudeStatus":{"state":"bogus"}}')).toEqual({ status: 'connected', claude: 'missing' });
});
test('claude.status events parse for the four states only', () => {
  for (const state of ['missing', 'logged_out', 'ready', 'limit_reached']) expect(parseClaudeStatus(`{"type":"claude.status","state":"${state}","message":"x"}`)).toEqual({ state, message: 'x' });
  expect(parseClaudeStatus('{"type":"claude.status","state":"weird"}')).toBeNull(); expect(parseClaudeStatus('{"type":"hello"}')).toBeNull(); expect(parseClaudeStatus('nope')).toBeNull();
});

describe('say.event done usage', () => {
  const ev = (extra: object) => JSON.stringify({ type: 'say.event', id: 'a', kind: 'done', ...extra });
  it('parses usage (cache counts fold into input) and stays optional', () => {
    expect(parseSayEvent(ev({ usage: { input_tokens: 10, output_tokens: 4, cache_read_input_tokens: 5, cache_creation_input_tokens: 1 } }))?.event).toEqual({ kind: 'done', usage: { input: 16, output: 4 } });
    expect(parseSayEvent(ev({}))?.event).toEqual({ kind: 'done' });
    expect(parseSayEvent(ev({ usage: 'junk' }))?.event).toEqual({ kind: 'done' });
  });
});
