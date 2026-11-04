import { expect, test } from 'vitest';
import { buildArtifactPage, isArtifactUrl, MAX_PAGE_BYTES, MAX_PAGE_FRAMES, safeFrameHtml } from './publish';
import { makeFrames } from './canvas/fixtures';
const fr = (n: number) => makeFrames(n).map((f) => ({ id: f.id, title: f.title, w: f.w, h: f.h, html: f.html }));
test('frame markup is made script-free: scripts, handlers and unsafe URLs go, images and https stay', () => {
  const s = safeFrameHtml('<div onclick="x()" id="a"><script>evil()</script><script src="//e"></script><img src="data:image/png;base64,AA" onerror=\'y()\'><a href="javascript:z()">l</a><a href="https://ok.example/x">m</a><a href="/local">n</a></div>');
  expect(s).not.toMatch(/<script|onclick|onerror|javascript:|evil/i); expect(s).toContain('src="data:image/png;base64,AA"'); expect(s).toContain('href="https://ok.example/x"'); expect(s).not.toContain('/local'); expect(s).toContain('id="a"');
});
test('the page is an artifact fragment: a title, theme tokens, side gutters, a tab per frame, frames in Shadow DOM (no iframes), escaped titles', () => {
  const r = buildArtifactPage('My <b>demo</b> & co', [{ id: 'a', title: 'TV "one"', w: 1920, h: 1080, html: '<div id="a">hi</div>' }, { id: 'b', title: 'Phone', w: 390, h: 844, html: '<i id="b"></i>' }]); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.frames).toBe(2); expect(r.html.startsWith('<title>My &lt;b&gt;demo&lt;/b&gt; &amp; co</title>')).toBe(true); expect(r.html).not.toMatch(/<!doctype|<html|<head|<body/i); expect(r.html).toContain('<meta name="claude:viewport-fit-sides" content="cover">'); expect(r.html).toContain('TV &quot;one&quot;');
  expect((r.html.match(/role="tab"/g) ?? []).length).toBe(2); expect((r.html.match(/<template>/g) ?? []).length).toBe(2); expect(r.html).not.toMatch(/<iframe|srcdoc/); expect(r.html).toContain('attachShadow'); expect(r.html).toContain('prefers-color-scheme:dark'); expect(r.html).toContain('padding-left:max(16px,env(safe-area-inset-left,0px))'); expect(r.html).toContain('color-scheme:dark');
  expect(r.html).not.toMatch(/(?:src|href)="https?:\/\/(?!ok)/); expect((r.html.match(/<script>/g) ?? []).length).toBe(1); // only the tab/fit script of the page itself
});
test('a frame cannot close the template it sits in, and the standalone form wraps the same page in a document', () => {
  const r = buildArtifactPage('x', [{ id: 'a', title: 't', w: 10, h: 10, html: '<div id="a">a</template><script>evil()</script><b>b</b></div>' }]); expect(r.ok).toBe(true); if (!r.ok) return; expect((r.html.match(/<\/template>/g) ?? []).length).toBe(1); expect(r.html).not.toContain('evil()');
  const st = buildArtifactPage('x', [{ id: 'a', title: 't', w: 10, h: 10, html: '<i id="a"></i>' }], { standalone: true }); expect(st.ok && st.html.startsWith('<!doctype html><html lang="en"><head>')).toBe(true); expect(st.ok && st.html).toContain('[hidden]{display:none!important}');
});
test('a real demo project builds within the size limit, and limits are enforced with reasons', () => {
  const r = buildArtifactPage('tvdash', fr(20)); expect(r.ok).toBe(true); if (r.ok) { expect(r.bytes).toBeLessThan(MAX_PAGE_BYTES); expect(r.frames).toBe(20); }
  expect(buildArtifactPage('x', [])).toMatchObject({ ok: false, error: expect.stringMatching(/no frames/) }); expect(buildArtifactPage('x', fr(MAX_PAGE_FRAMES + 1).concat(fr(1)))).toMatchObject({ ok: false, error: expect.stringMatching(/at most 24/) });
  expect(buildArtifactPage('x', [{ id: 'a', title: 't', w: 10, h: 10, html: 'x'.repeat(MAX_PAGE_BYTES) }])).toMatchObject({ ok: false, error: expect.stringMatching(/MB/) });
});
test('only claude.ai artifact links are remembered', () => { expect(isArtifactUrl('https://claude.ai/artifact/abc123')).toBe(true); expect(isArtifactUrl('https://claude.ai/code/artifact/0b1c')).toBe(true); for (const bad of ['http://claude.ai/artifact/x', 'https://evil.com/artifact/x', 'https://claude.ai/chat/x', 'javascript:1', 'nope']) expect(isArtifactUrl(bad), bad).toBe(false); });
