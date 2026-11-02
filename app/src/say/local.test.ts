import { expect, test } from 'vitest';
import { localEdits } from './local';
const ctx = (fs?: string) => ({ get: async (p: string) => (p === 'font-size' ? fs : undefined) });
test('bigger/smaller scale the current font size; no size, no local answer', async () => {
  expect(await localEdits('bigger', ctx('100px'))).toEqual([{ prop: 'font-size', value: '125px' }]); expect(await localEdits('Make it smaller.', ctx('100px'))).toEqual([{ prop: 'font-size', value: '80px' }]);
  expect(await localEdits('a bit bigger', ctx('230px'))).toEqual([{ prop: 'font-size', value: '253px' }]); expect(await localEdits('bigger', ctx(undefined))).toBeNull(); expect(await localEdits('bigger', ctx('2em'))).toBeNull(); expect(await localEdits('bigger', ctx('0px'))).toBeNull();
});
test('hide, show, opacity, colours and sizes', async () => {
  expect(await localEdits('hide', ctx())).toEqual([{ prop: 'opacity', value: '0' }]); expect(await localEdits('show', ctx())).toEqual([{ prop: 'opacity', value: '1' }]);
  expect(await localEdits('opacity 50%', ctx())).toEqual([{ prop: 'opacity', value: '0.5' }]); expect(await localEdits('opacity 150%', ctx())).toBeNull();
  expect(await localEdits('color #FF0000', ctx())).toEqual([{ prop: 'color', value: '#ff0000' }]); expect(await localEdits('make it red', ctx())).toBeNull(); expect(await localEdits('text color to red', ctx())).toEqual([{ prop: 'color', value: 'red' }]);
  expect(await localEdits('background teal', ctx())).toEqual([{ prop: 'background-color', value: 'teal' }]); expect(await localEdits('font size 48', ctx())).toEqual([{ prop: 'font-size', value: '48px' }]); expect(await localEdits('width 300px', ctx())).toEqual([{ prop: 'width', value: '300px' }]);
});
test('anything ambiguous or creative goes to Claude (null), including injection-looking values', async () => {
  for (const r of ['', 'make it feel warmer', 'color url(javascript:alert(1))', 'color #12', 'background expression(x)', 'color red; position:fixed', 'bigger and bolder']) expect(await localEdits(r, ctx('10px')), r).toBeNull();
});
test('type, alignment, corners, padding and border rules', async () => {
  const g = (vals: Record<string, string>) => ({ get: async (p: string) => vals[p] });
  expect(await localEdits('bold', ctx())).toEqual([{ prop: 'font-weight', value: '700' }]); expect(await localEdits('Italic.', ctx())).toEqual([{ prop: 'font-style', value: 'italic' }]); expect(await localEdits('all caps', ctx())).toEqual([{ prop: 'text-transform', value: 'uppercase' }]);
  expect(await localEdits('underline', ctx())).toEqual([{ prop: 'text-decoration', value: 'underline' }]); expect(await localEdits('align center', ctx())).toEqual([{ prop: 'text-align', value: 'center' }]); expect(await localEdits('text align left', ctx())).toEqual([{ prop: 'text-align', value: 'left' }]);
  expect(await localEdits('left', ctx())).toBeNull(); expect(await localEdits('rounder', g({ 'border-radius': '12px' }))).toEqual([{ prop: 'border-radius', value: '20px' }]); expect(await localEdits('rounder', g({}))).toEqual([{ prop: 'border-radius', value: '8px' }]);
  expect(await localEdits('sharper', g({ 'border-radius': '12px' }))).toEqual([{ prop: 'border-radius', value: '4px' }]); expect(await localEdits('sharper', g({ 'border-radius': '4px' }))).toEqual([{ prop: 'border-radius', value: '0px' }]); expect(await localEdits('sharper', g({}))).toBeNull(); expect(await localEdits('square corners', g({ 'border-radius': '12px' }))).toEqual([{ prop: 'border-radius', value: '0px' }]);
  expect(await localEdits('more padding', g({ 'padding-top': '16px' }))).toEqual([{ prop: 'padding', value: '24px' }]); expect(await localEdits('more padding', g({}))).toBeNull(); expect(await localEdits('no border', ctx())).toEqual([{ prop: 'border', value: 'none' }]);
  expect(await localEdits('bold and italic', ctx())).toBeNull(); expect(await localEdits('make it feel premium', ctx())).toBeNull();
});
