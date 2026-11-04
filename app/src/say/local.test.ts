import { expect, test } from 'vitest';
import { localEdits, propTokenRequest, themeRequest, tokenRequest } from './local';
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

test('a subject phrase is ignored (the selection is the subject), colours need a subject, padding takes a number', async () => {
  const ctx = (v: Record<string, string>) => ({ get: async (p: string) => v[p] });
  expect(await localEdits('make the clock bigger', ctx({ 'font-size': '100px' }))).toEqual([{ prop: 'font-size', value: '125px' }]);
  expect(await localEdits('make the text white', ctx({}))).toEqual([{ prop: 'color', value: 'white' }]);
  expect(await localEdits('make the background black', ctx({}))).toEqual([{ prop: 'background-color', value: 'black' }]);
  expect(await localEdits('make it red', ctx({}))).toBeNull(); expect(await localEdits('make the glass thicker', ctx({}))).toBeNull();
  expect(await localEdits('increase padding to 32', ctx({}))).toEqual([{ prop: 'padding', value: '32px' }]); expect(await localEdits('round the corners more', ctx({ 'border-radius': '4px' }))).toEqual([{ prop: 'border-radius', value: '12px' }]);
});

test('colour token requests find the kit token by role and need a hex token to rewrite', () => {
  const kit = { '--ac': '#0a84ff', '--ok': '#30d158', '--bg': '#0b0b0f', '--glass': 'rgba(0,0,0,.3)' };
  expect(tokenRequest('change the accent to green', kit)).toEqual({ name: '--ac', value: '#30d158' }); expect(tokenRequest('Set the background colour to #fff', kit)).toEqual({ name: '--bg', value: '#ffffff' });
  expect(tokenRequest('make the success purple', kit)).toEqual({ name: '--ok', value: '#bf5af2' }); expect(tokenRequest('change the accent to chartreuse', kit)).toBeNull(); expect(tokenRequest('change the border to red', kit)).toBeNull();
  expect(tokenRequest('change the accent to green', { '--accent': 'oklch(.5 .1 30)' })).toBeNull(); expect(tokenRequest('change the accent', kit)).toBeNull();
});

test('px and font tokens: scale by phrase, swap a font family, only when the kit has such a token', () => {
  const kit = { '--blur': '24px', '--rad': '16px', '--font': 'Inter, system-ui, sans-serif', '--ac': '#0a84ff' };
  expect(propTokenRequest('make the glass thicker', kit)).toEqual({ name: '--blur', value: '36px' }); expect(propTokenRequest('reduce the blur', kit)).toEqual({ name: '--blur', value: '14.4px' });
  expect(propTokenRequest('rounder corners', kit)).toEqual({ name: '--rad', value: '24px' }); expect(propTokenRequest('make the corners sharper', kit)).toEqual({ name: '--rad', value: '9.6px' });
  expect(propTokenRequest('use Barlow instead of Inter', kit)).toEqual({ name: '--font', value: 'Barlow, system-ui, sans-serif' });
  expect(propTokenRequest('use Barlow instead of Helvetica', kit)).toBeNull(); expect(propTokenRequest('make the glass thicker', { '--ac': '#fff' })).toBeNull(); expect(propTokenRequest('make the glass nicer', kit)).toBeNull();
});

test('dark and light themes change the background and text tokens together, only when the kit has both', () => {
  const kit = { '--bg': '#ffffff', '--tx': '#111111', '--ac': '#0a84ff' };
  expect(themeRequest('turn this into a dark theme', kit)).toEqual([{ name: '--bg', value: '#0b0b0f' }, { name: '--tx', value: '#f5f5f7' }]); expect(themeRequest('make it light', kit)).toEqual([{ name: '--bg', value: '#f5f5f7' }, { name: '--tx', value: '#1c1c1e' }]);
  expect(themeRequest('switch to dark mode', kit)).not.toBeNull(); expect(themeRequest('turn this into a dark theme', { '--bg': '#fff' })).toBeNull(); expect(themeRequest('make it darker', kit)).toBeNull();
});

test('"nudge the title up 8 px" moves by left/top or translate, like the arrow keys', async () => {
  const ctx = (v: Record<string, string>) => ({ get: async (p: string) => v[p] });
  expect(await localEdits('nudge the title up 8 px', ctx({ position: 'absolute', left: '10px', top: '20px' }))).toEqual([{ prop: 'left', value: '10px' }, { prop: 'top', value: '12px' }]);
  expect(await localEdits('move it right 5px', ctx({ position: 'static', left: 'auto', top: 'auto', translate: 'none' }))).toEqual([{ prop: 'translate', value: '5px 0px' }]);
  expect(await localEdits('nudge it up', ctx({}))).toBeNull();
});
test('easeRequest maps plain ease words to the motion eases, and ignores everything else', async () => {
  const { easeRequest } = await import('./local');
  expect([ 'make it ease out', 'Make it ease in.', 'ease it in and out', 'make it linear', 'make it bounce with an ease' ].map(easeRequest)).toEqual(['expo.out', 'expo.in', 'expo.inOut', 'linear', 'back.out']);
  for (const no of ['make it bigger', 'this is easy', 'make the title ease', 'ease out the margins please maybe']) expect(easeRequest(no)).toBeNull();
});
