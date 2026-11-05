import { expect, test } from 'vitest';
import type { FrameDef } from './canvas/fixtures';
import { handleMcp, type McpEnv } from './mcp';
import { instantiateTemplate, parseTemplate } from './template';
import { slugify, templateFromFrames, templateFromScan } from './saveTemplate';
const frame = (html: string, over: Partial<FrameDef> = {}): FrameDef => ({ id: 'home', root: 'home', title: 'Home', x: 10, y: 20, w: 1280, h: 800, html, ...over });
const HTML = '<div id="home" style="--ac:#0a84ff;--bg:#111"><h1 id="title">Ship faster &amp; safer</h1><p>One tool for the <b>whole</b> team.</p><ul>\n  <li>Fast</li>\n  <li>Clear</li>\n  <li>Yours</li>\n</ul><button class="cta">Get started</button><style>.cta{color:red}</style></div>';
const mk = (frames: FrameDef[], name = 'My Landing') => { const r = templateFromFrames(frames, { name }); if (!r.ok) throw new Error(r.error); return r; };
test('selection -> template: text and lists become slots, tokens come from the root, and it validates and round-trips', () => {
  const r = mk([frame(HTML)]); const t = parseTemplate(r.folder); expect(t.ok).toBe(true); if (!t.ok) return;
  expect(r.slug).toBe('my-landing'); expect(t.value.tokens).toEqual({ '--ac': '#0a84ff', '--bg': '#111' }); expect(t.warnings).toEqual([]);
  const byType = t.value.slots.map((s) => [s.type, s.default]); expect(byType).toContainEqual(['text', 'Ship faster & safer']); expect(byType).toContainEqual(['list', ['Fast', 'Clear', 'Yours']]); expect(byType).toContainEqual(['text', 'Get started']);
  expect(r.folder.files['frames/home.html']).not.toContain('Ship faster'); expect(r.folder.files['frames/home.html']).toContain('.cta{color:red}'); // css untouched
  const same = instantiateTemplate(t.value); expect(same.ok && same.value.frames[0]).toMatchObject({ id: 'home', root: 'home', x: 10, y: 20, w: 1280, h: 800 });
  const slotFor = (text: string) => t.value.slots.find((s) => s.default === text)!.id;
  const fresh = instantiateTemplate(t.value, { [slotFor('Ship faster & safer')]: 'Brand <new> "line"', [slotFor('Get started')]: 'Buy', ...Object.fromEntries(t.value.slots.filter((s) => s.type === 'list').map((s) => [s.id, ['A', 'B']])) });
  expect(fresh.ok).toBe(true); if (!fresh.ok) return; const h = fresh.value.frames[0]!.html; expect(h).toContain('Brand &lt;new&gt; &quot;line&quot;'); expect(h).toContain('<li>A</li><li>B</li>'); expect(h).toContain('Buy'); expect(h).not.toContain('Ship faster');
});
test('several frames get prefixed slot ids and unique files', () => {
  const r = mk([frame('<div id="home"><h1>Hello</h1></div>'), frame('<div id="home"><h1>World</h1></div>', { id: 'home2' }), frame('<div id="b"><h1>Third</h1></div>', { id: 'Home', root: 'b' })]); const t = parseTemplate(r.folder);
  expect(t.ok && t.value.frames.length).toBe(3); expect(t.ok && new Set(t.value.slots.map((s) => s.id)).size).toBe(3); expect(Object.keys(r.folder.files).sort()).toEqual(['frames/home-2.html', 'frames/home.html', 'frames/home2.html', 'template.json']);
});
test('text that cannot be templated stays literal; refusals say why', () => {
  const r = mk([frame('<div id="home"><p>Tom &nbsp; Jerry</p><p>say "hi"</p><p>1 &lt; 2</p><p>---</p><p>ok text</p></div>')]); const t = parseTemplate(r.folder); if (!t.ok) throw new Error(t.error);
  expect(t.value.slots.map((s) => s.default)).toEqual(['1 < 2', 'ok text']); expect(r.folder.files['frames/home.html']).toContain('Tom &nbsp; Jerry');
  const bad = (f: FrameDef[], name = 'x') => { const x = templateFromFrames(f, { name }); return x.ok ? '' : x.error; };
  expect(bad([])).toMatch(/select a frame/); expect(bad([frame(HTML)], '!!!')).toMatch(/name/); expect(bad([frame('<div id="home"><script>1</script></div>')])).toMatch(/forbidden element/);
  expect(bad([frame('<div id="home">{{x}}</div>')])).toMatch(/\{\{/); expect(bad([frame('<div id="other">a</div>')])).toMatch(/no root/); expect(bad(Array.from({ length: 13 }, (_, i) => frame('<div id="home">a</div>', { id: `f${i}` })))).toMatch(/too many/);
});
test('more text nodes than slots: the rest stays literal and the template is still valid', () => {
  const html = `<div id="home">${Array.from({ length: 60 }, (_, i) => `<p>line ${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}</p>`).join('')}</div>`; const r = mk([frame(html)]); expect(r.slots).toBe(40); expect(parseTemplate(r.folder).ok).toBe(true);
});
test('slugify', () => { expect(slugify('Hello, Wörld  2!')).toBe('hello-world-2'); expect(slugify('***')).toBeNull(); expect(slugify('a'.repeat(80))!.length).toBe(40); });
const scan = { tokens: [{ name: '--ink', value: '#0b0b0f' }, { name: '--bg', value: '#fafafa' }, { name: '--accent', value: '#ff4d00' }, { name: '--bad', value: 'red;x' }], colors: [], fonts: [{ value: 'Inter', count: 3 }] };
test('repo tokens -> a starter in the repo brand', () => {
  const r = templateFromScan(scan, { name: 'Acme brand' }); if (!r.ok) throw new Error(r.error); const t = parseTemplate(r.folder); if (!t.ok) throw new Error(t.error);
  expect(t.value.tokens).toEqual({ '--ink': '#0b0b0f', '--bg': '#fafafa', '--accent': '#ff4d00' }); const i = instantiateTemplate(t.value, { headline: 'Hi Acme' }); if (!i.ok) throw new Error(i.error);
  expect(i.value.tokens['--accent']).toBe('#ff4d00'); expect(i.value.frames[0]!.html).toContain('background:var(--bg)'); expect(i.value.frames[0]!.html).toContain('var(--accent)'); expect(i.value.frames[0]!.html).toContain('Hi Acme');
});
test('repo with only colours/fonts and no tokens builds --color-N; an empty scan is refused', () => {
  const r = templateFromScan({ tokens: [], colors: [{ value: '#101010', count: 9 }, { value: '#f5f5f5', count: 5 }, { value: '#3366ff', count: 2 }], fonts: [{ value: "Bar'low", count: 1 }] }, { name: 'Colours' }); if (!r.ok) throw new Error(r.error); const t = parseTemplate(r.folder); if (!t.ok) throw new Error(t.error);
  expect(Object.keys(t.value.tokens)).toEqual(['--color-1', '--color-2', '--color-3', '--font-1']); const i = instantiateTemplate(t.value); expect(i.ok && i.value.frames[0]!.html).toContain('#3366ff'); expect(i.ok && i.value.frames[0]!.html).toContain('background:#101010');
  const e = templateFromScan({ tokens: [{ name: 'x', value: 'y' }], colors: [], fonts: [] }, { name: 'n' }); expect(!e.ok && e.error).toMatch(/no design tokens/); const n = templateFromScan(scan, { name: '' }); expect(n.ok).toBe(false);
});
test('MCP save_template: selected frame, a scan, and bad input', async () => {
  const f = frame(HTML); const env = { frames: [f], selection: null, api: undefined, record: () => undefined, undo: async () => false, bump: () => undefined } as unknown as McpEnv;
  const r = await handleMcp(env, 'save_template', { name: 'From MCP' }) as { slug: string; files: Record<string, string> }; expect(r.slug).toBe('from-mcp'); expect(parseTemplate({ files: r.files }).ok).toBe(true);
  const s = await handleMcp(env, 'save_template', { name: 'Repo', scan }) as { files: Record<string, string> }; expect(parseTemplate({ files: s.files }).ok).toBe(true);
  await expect(handleMcp(env, 'save_template', {})).rejects.toThrow(/name is required/); await expect(handleMcp(env, 'save_template', { name: 'x', frames: ['nope'] })).rejects.toThrow(/unknown frame/);
});
