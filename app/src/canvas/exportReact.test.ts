import { expect, test } from 'vitest';
import { componentName, frameToTsx, parseHtml, styleObject } from './exportReact';
import { tvIdle } from './fixtures';
test('style strings become object literals; custom properties stay quoted; functions with semicolons-free commas survive', () => {
  expect(styleObject('font-size:24px;background:linear-gradient(135deg,#000,#fff);--ac:#0a84ff;')).toBe('{{ fontSize: "24px", background: "linear-gradient(135deg,#000,#fff)", "--ac": "#0a84ff" }}');
  expect(styleObject("font-family:var(--font,'SF Pro; x');color:red")).toBe('{{ fontFamily: "var(--font,\'SF Pro; x\')", color: "red" }}'); expect(styleObject('')).toBe('{{  }}');
});
test('attributes: class, for, boolean attributes, ids kept; handlers, srcdoc and javascript: URLs dropped', () => {
  const t = frameToTsx('x', '<div id="a" class="c" onclick="evil()"><label for="i">L</label><input id="i" disabled><a href="javascript:alert(1)">x</a><a href="https://e.com">y</a><img src="data:image/png;base64,AA=="></div>');
  expect(t).toContain('<div id="a" className="c">'); expect(t).toContain('htmlFor="i"'); expect(t).toContain('<input id="i" disabled />'); expect(t).not.toMatch(/onclick|javascript:|evil/); expect(t).toContain('href="https://e.com"'); expect(t).toContain('<img src="data:image/png;base64,AA==" />');
});
test('text with braces and angle brackets cannot become code; scripts and comments vanish', () => {
  const t = frameToTsx('x', '<div id="a">{x} &lt;b&gt; <!-- hi --><script>steal()</script>ok</div>'); expect(t).toContain('{"{"}x{"}"} {"<"}b{">"}'); expect(t).toMatch(/\n\s+ok\n/); expect(t).not.toContain('steal'); expect(t).not.toContain('hi -->');
});
test('void tags, nesting and unclosed tags are handled; stray closers are ignored', () => { const n = parseHtml('<div id="a"><br><span>1</span></p></div>'); expect(n).toHaveLength(1); const a = n[0] as { kids: { tag: string }[] }; expect(a.kids.map((k) => k.tag)).toEqual(['br', 'span']); expect(parseHtml('<div><span>x')).toHaveLength(1); });
test('component names are valid identifiers', () => { expect(componentName('TV · Idle 1920×1080')).toBe('TvIdle1920x1080'); expect(componentName('3 cards')).toBe('Frame3Cards'); expect(componentName('???')).toBe('Frame'); });
test('two top-level nodes are wrapped in a fragment', () => expect(frameToTsx('x', '<i id="a"></i><b id="b"></b>')).toMatch(/<>[\s\S]*<i id="a" \/>[\s\S]*<b id="b" \/>[\s\S]*<\/>/));
test('the real tvdash frame converts: every element id survives and the output is balanced', () => {
  const html = tvIdle(); const t = frameToTsx('TV Idle', html); for (const id of [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!)) expect(t).toContain(`id="${id}"`);
  const open = (t.match(/<(?!\/)(?!>)[a-z][^>]*[^/]>/g) ?? []).length, close = (t.match(/<\/[a-z]+>/g) ?? []).length; expect(open).toBe(close); expect(t).not.toMatch(/\bclass=|style="/);
});
