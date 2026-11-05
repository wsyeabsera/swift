import { expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { instantiateTemplate, MAX_FRAME_HTML, MAX_MANIFEST, parseTemplate, unsafeReason, type TemplateFolder } from './template';
import { loadTemplates, readTemplateFolder } from './templateSources';
const manifest = (over: Record<string, unknown> = {}) => ({ swiftCanvasTemplate: 1, name: 'Landing', description: 'A hero', slots: [{ id: 'headline', type: 'text', label: 'Headline', prompt: 'The main promise', default: 'Hello' }, { id: 'features', type: 'list', default: ['a', 'b'] }, { id: 'hero', type: 'image', default: 'https://x.test/a.png' }, { id: 'accent', type: 'color', default: '#0a84ff' }], tokens: { '--bg': '#111' }, frames: [{ id: 'home', title: 'Home', file: 'home.html', w: 1280, h: 800 }], ...over });
const HTML = '<div id="home"><h1 id="h">{{headline}}</h1><ul>{{features}}</ul><img src="{{hero}}"><b style="color:{{accent}}">x</b></div>';
const folder = (m: unknown = manifest(), html = HTML): TemplateFolder => ({ files: { 'template.json': JSON.stringify(m), 'frames/home.html': html } });
const err = (f: TemplateFolder): string => { const r = parseTemplate(f); if (r.ok) throw new Error('expected failure'); return r.error; };
test('a good template loads; defaults fill; text is escaped; list becomes li', () => {
  const r = parseTemplate(folder()); expect(r.ok).toBe(true); if (!r.ok) return;
  const i = instantiateTemplate(r.value, { headline: '<b>"Hi" & bye</b>' }); expect(i.ok).toBe(true); if (!i.ok) return;
  expect(i.value.frames[0]!.html).toContain('&lt;b&gt;&quot;Hi&quot; &amp; bye&lt;/b&gt;'); expect(i.value.frames[0]!.html).toContain('<li>a</li><li>b</li>'); expect(i.value.frames[0]!.root).toBe('home'); expect(i.value.tokens).toEqual({ '--bg': '#111' });
});
test('bad manifests are refused with a reason', () => {
  expect(err({ files: {} })).toMatch(/template.json is missing/); expect(err({ files: { 'template.json': '{nope' } })).toMatch(/not JSON/); expect(err({ files: { 'template.json': '[]' } })).toMatch(/object/);
  expect(err(folder(manifest({ swiftCanvasTemplate: 2 })))).toMatch(/newer version/); expect(err(folder(manifest({ name: '' })))).toMatch(/name/);
  expect(err(folder(manifest({ slots: [{ id: 'Bad Id', type: 'text' }] })))).toMatch(/needs an id/); expect(err(folder(manifest({ slots: [{ id: 'a', type: 'video' }] })))).toMatch(/type must be/);
  expect(err(folder(manifest({ slots: [{ id: 'headline', type: 'text', default: 5 }] })))).toMatch(/default of headline/); expect(err(folder(manifest({ frames: [] })))).toMatch(/frames/);
  expect(err(folder(manifest({ tokens: { '--bg': 'red;x:y' } })))).toMatch(/token --bg/); expect(err(folder(manifest({ tokens: { bg: '#fff' } })))).toMatch(/token bg/);
  expect(err(folder(manifest({ frames: [{ id: 'home', file: '../x.html', w: 1, h: 1 }] })))).toMatch(/plain name/); expect(err(folder(manifest({ frames: [{ id: 'home', file: 'home.html', w: 0, h: 1 }] })))).toMatch(/positive/);
});
test('missing slot, missing file, missing root, duplicates', () => {
  expect(err(folder(manifest(), '<div id="home">{{nope}}</div>'))).toMatch(/\{\{nope\}\} has no slot/); expect(err(folder(manifest({ frames: [{ id: 'home', file: 'gone.html', w: 1, h: 1 }] })))).toMatch(/gone.html is missing/);
  expect(err(folder(manifest(), '<div>{{headline}}</div>'))).toMatch(/no root element/);
  expect(err(folder(manifest({ slots: [{ id: 'a', type: 'text' }, { id: 'a', type: 'text' }] })))).toMatch(/duplicate slot "a"/);
  const dup = manifest({ frames: [{ id: 'home', file: 'home.html', w: 1, h: 1 }, { id: 'home', file: 'home.html', w: 1, h: 1 }] }); expect(err(folder(dup))).toMatch(/duplicate frame/);
});
test('an unused slot is only a warning', () => { const r = parseTemplate(folder(manifest(), '<div id="home">{{headline}}</div>')); expect(r.ok && r.warnings.length).toBe(3); });
test('oversize is refused', () => {
  expect(err(folder(manifest({ description: 'x'.repeat(MAX_MANIFEST) })))).toMatch(/too large/); expect(err(folder(manifest(), `<div id="home">${'a'.repeat(MAX_FRAME_HTML)}</div>`))).toMatch(/too large/);
  expect(err(folder(manifest({ slots: Array.from({ length: 41 }, (_, i) => ({ id: `s${i}`.replace(/\d/g, (d) => 'abcdefghij'[+d]!), type: 'text' })) })))).toMatch(/at most 40/);
});
test('active content is refused', () => {
  for (const bad of ['<script>x</script>', '<iframe src=a>', '<img src=x onerror=alert(1)>', '<a href="javascript:x">', '<style>@import "x";</style>', '<style>a{background:url(https://evil/x)}</style>', '<form>', '<link rel=stylesheet href=x>']) { expect(unsafeReason(bad), bad).not.toBeNull(); expect(err(folder(manifest(), `<div id="home">${bad}</div>`))).toMatch(/contains/); }
  expect(unsafeReason('<div id="a" style="color:red">on sale — one line</div>')).toBeNull();
});
test('filling: unknown slot, bad values, required slots', () => {
  const t = (parseTemplate(folder()) as { ok: true; value: Parameters<typeof instantiateTemplate>[0] }).value;
  const bad = (v: Record<string, unknown>) => { const r = instantiateTemplate(t, v); return r.ok ? '' : r.error; };
  expect(bad({ nope: 'x' })).toMatch(/unknown slot "nope"/); expect(bad({ hero: 'javascript:alert(1)' })).toMatch(/https/); expect(bad({ hero: 'http://x.test/a.png' })).toMatch(/https/); expect(bad({ accent: 'red; x:y' })).toMatch(/colour/);
  expect(bad({ features: 'a' })).toMatch(/list/); expect(bad({ headline: 'x'.repeat(2001) })).toMatch(/text up to/); expect(bad({ hero: 'data:image/png;base64,AAAA' })).toBe('');
  const req = parseTemplate(folder(manifest({ slots: [{ id: 'headline', type: 'text', required: true, prompt: 'the promise' }, { id: 'features', type: 'list' }, { id: 'hero', type: 'image' }, { id: 'accent', type: 'color', default: '#fff' }] })));
  if (!req.ok) throw new Error(req.error); const r = instantiateTemplate(req.value, {}); expect(!r.ok && r.error).toMatch(/slot "headline" needs a value: the promise/);
  const r2 = instantiateTemplate(req.value, { headline: 'x' }); expect(!r2.ok && r2.error).toMatch(/slot "hero"/); expect(instantiateTemplate(req.value, { headline: 'x', hero: 'https://a.test/i.png' }).ok).toBe(true);
});
test('frames without x/y are laid out in a row', () => {
  const m = manifest({ frames: [{ id: 'a', file: 'a.html', w: 100, h: 50 }, { id: 'b', file: 'b.html', w: 100, h: 50, y: 7 }] }); const f = { files: { 'template.json': JSON.stringify(m), 'frames/a.html': '<div id="a">{{headline}}</div>', 'frames/b.html': '<div id="b">{{features}}{{hero}}{{accent}}</div>' } };
  const t = parseTemplate(f); if (!t.ok) throw new Error(t.error); const i = instantiateTemplate(t.value); expect(i.ok && i.value.frames.map((x) => [x.x, x.y])).toEqual([[0, 0], [220, 7]]);
});
test('sources: disk folders, precedence builtin < user < repo, duplicates and bad folders reported', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sc-tpl-')); const put = (root: string, dir: string, m: unknown, html = HTML) => { const d = join(tmp, root, dir); mkdirSync(join(d, 'frames'), { recursive: true }); writeFileSync(join(d, 'template.json'), typeof m === 'string' ? m : JSON.stringify(m)); writeFileSync(join(d, 'frames', 'home.html'), html); return d; };
  put('user', 'landing', manifest({ description: 'user one' })); put('user', 'landing-copy', manifest({ description: 'dup' })); put('user', 'broken', '{nope'); put('user', 'other', manifest({ name: 'Other' }));
  put('repo', 'landing', manifest({ description: 'repo one' })); mkdirSync(join(tmp, 'user', 'empty-dir')); writeFileSync(join(tmp, 'user', 'file.txt'), 'x');
  const outside = join(tmp, 'secret.html'); writeFileSync(outside, '<div id="home">secret</div>'); symlinkSync(outside, join(tmp, 'user', 'other', 'frames', 'home.html') + '.bak'); // non-html symlink ignored
  const b = (parseTemplate(folder(manifest({ name: 'Landing', description: 'builtin' }))) as { ok: true }).ok; expect(b).toBe(true);
  const r = loadTemplates({ builtin: [{ dir: 'builtin:landing', folder: folder(manifest({ description: 'builtin' })) }], userDir: join(tmp, 'user'), repoDir: join(tmp, 'repo') });
  expect(r.templates.map((t) => [t.name, t.source, t.description])).toEqual([['Landing', 'repo', 'repo one'], ['Other', 'user', 'A hero']]); expect(r.templates[0]!.shadows).toEqual(['builtin']);
  expect(r.problems.map((p) => [p.source, p.dir.split('/').pop(), p.error])).toEqual([['user', 'broken', 'template.json is not JSON'], ['user', 'landing-copy', expect.stringMatching(/duplicate template name "Landing"/)]]);
  expect(loadTemplates({ userDir: join(tmp, 'nope') })).toEqual({ templates: [], problems: [] });
});
test('a symlinked template.json or oversize file is not followed/read', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sc-tpl-')); const d = join(tmp, 't'); mkdirSync(join(d, 'frames'), { recursive: true }); writeFileSync(join(tmp, 'real.json'), '{}'); symlinkSync(join(tmp, 'real.json'), join(d, 'template.json'));
  const r = readTemplateFolder(d); expect(r.ok && r.folder.files).toEqual({}); const d2 = join(tmp, 'u'); mkdirSync(d2); writeFileSync(join(d2, 'template.json'), 'x'.repeat(MAX_MANIFEST * 4 + 1)); expect(readTemplateFolder(d2)).toEqual({ ok: false, error: 'template.json too large' });
});
