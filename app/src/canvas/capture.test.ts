import { expect, test } from 'vitest';
import { assignIds, captureToFrame, pageTokens, retargetRoot } from './capture';
const page = `<!DOCTYPE html><html><head><title>t</title><style>body{background:#111;margin:0}html{font-size:14px}.card,.x body{padding:4px}h1{color:red}</style></head><body class="dark" style="color:#eee"><h1>Hi</h1><img src="a.png"><div id="keep"><p>x</p></div><script>evil()</script></body></html>`;
test('every element without an id gets a unique one, existing ids are kept, style text is untouched', () => {
  const out = assignIds('<div><p id="n1">a</p><span>b</span><br><style>p>b{color:red}</style></div>'); const ids = [...out.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  expect(new Set(ids).size).toBe(ids.length); expect(ids).toContain('n1'); expect(out).toContain('<style>p>b{color:red}</style>'); expect(out).toContain('<br>'); expect(ids.filter((i) => i !== 'n1')).toEqual(['n2', 'n3']);
});
test('html/body/:root rules follow the frame root, other selectors stay', () => { expect(retargetRoot('body{a:b}html{c:d}.x body{e:f}h1,body{g:h}.body{i:j}')).toBe('#page{a:b}#page{c:d}.x #page{e:f}h1,#page{g:h}.body{i:j}'); });
test('a captured page becomes one frame with a root, carried body styling, ids and no scripts', () => {
  const f = captureToFrame(page); expect(f.root).toBe('page'); expect(f).toMatchObject({ w: 1280, h: 800 });
  expect(f.html).toMatch(/^<div id="page" class="dark" style="color:#eee;position:relative;width:1280px;height:800px/); expect(f.html).toContain('#page{background:#111;margin:0}'); expect(f.html).not.toMatch(/<script|evil/);
  expect(f.html).toContain('id="keep"'); expect(f.html).toMatch(/<h1 id="n\d+">Hi<\/h1>/); expect(f.html).toMatch(/<img id="n\d+" src="a.png">/);
});
test('a fragment without a body still works', () => { const f = captureToFrame('<p>x</p>'); expect(f.html).toContain('<p id="n1">x</p>'); });

test('brand tokens are the custom properties of :root/html/body, later ones win, other rules are ignored', () => {
  const html = '<style>:root{--bg:#111;--fg: #eee}.card{--x:1}html,body{--bg:#222}</style><style>body{--accent:rgb(1,2,3)}</style>';
  expect(pageTokens(html)).toEqual([{ name: '--bg', value: '#222' }, { name: '--fg', value: '#eee' }, { name: '--accent', value: 'rgb(1,2,3)' }]); expect(pageTokens('<p>none</p>')).toEqual([]);
});

test('full page keeps the width, grows with the content and does not clip', () => {
  const f = captureToFrame('<body><p>x</p></body>', { w: 390, h: 844 }, true).html; expect(f).toContain('width:390px;min-height:844px'); expect(f).not.toMatch(/overflow:hidden|[^-]height:844px/);
  expect(captureToFrame('<body><p>x</p></body>', { w: 390, h: 844 }).html).toContain('height:844px;overflow:hidden');
});
