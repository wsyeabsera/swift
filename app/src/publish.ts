/** The project as ONE self-contained page for a Claude artifact: a tab per frame, each frame isolated in a Shadow DOM (scripts stripped) and scaled to fit the width, light/dark chrome that follows the viewer.
 *  Built from the frames' CURRENT markup; no network, no external files, a size cap. A Claude Code session publishes it with its Artifact tool (the app cannot): see the MCP tool `artifact_page`. Pure. */
export type PageFrame = { id: string; title: string; w: number; h: number; html: string };
export const MAX_PAGE_BYTES = 2 * 1024 * 1024; export const MAX_PAGE_FRAMES = 24;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Frame markup made safe for a script-free srcdoc: scripts, handlers and non-image/https URLs go; a CSP forbids anything else. */
export function safeFrameHtml(html: string): string {
  return html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '').replace(/<script\b[^>]*>/gi, '').replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/\s(href|src|xlink:href)\s*=\s*(["'])\s*(?!https?:|data:image\/|#)[^"']*\2/gi, ' $1=$2$2');
}
/** The project as an artifact page. By default a FRAGMENT (a `<title>`, the styles and the content): the Artifact tool wraps it in its own document skeleton, so a Claude Code session can publish it as it is.
 *  `standalone: true` adds the document wrapper for a file you open yourself. Frames are not iframes (an artifact viewer is a locked-down frame): each one sits in a Shadow DOM built from an inert `<template>`, so its styles cannot leak out or in. */
export function buildArtifactPage(project: string, frames: PageFrame[], opts: { standalone?: boolean } = {}): { ok: true; html: string; bytes: number; frames: number } | { ok: false; error: string } {
  if (!frames.length) return { ok: false, error: 'the project has no frames' }; if (frames.length > MAX_PAGE_FRAMES) return { ok: false, error: `at most ${MAX_PAGE_FRAMES} frames per page (pick fewer)` };
  const tabs = frames.map((f, i) => `<button class="tab" id="tab-${i}" role="tab" aria-selected="${i === 0}" aria-controls="pane-${i}" data-i="${i}">${esc(f.title)}</button>`).join('');
  const panes = frames.map((f, i) => `<section class="pane" id="pane-${i}" role="tabpanel" aria-labelledby="tab-${i}" data-w="${Math.round(f.w)}" data-h="${Math.round(f.h)}"${i === 0 ? '' : ' hidden'}><div class="stage"><div class="frame"></div><template>${safeFrameHtml(f.html).replace(/<\/template/gi, '&lt;/template')}</template></div></section>`).join('');
  const body = `<title>${esc(project)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: a title block, pill tabs, one scaled frame at a time. Neutrals lean slightly cool, the accent is a deep teal (light) or mint (dark). */
:root{--bg:#f3f5f7;--fg:#14181f;--mu:#5a6372;--card:#ffffff;--bd:#d6dbe3;--ac:#0b7a66;--ac-fg:#ffffff}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0d1014;--fg:#eceff4;--mu:#98a1b1;--card:#161a21;--bd:#272d38;--ac:#7cf0d0;--ac-fg:#06201a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0d1014;--fg:#eceff4;--mu:#98a1b1;--card:#161a21;--bd:#272d38;--ac:#7cf0d0;--ac-fg:#06201a;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;padding-block:20px 32px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{margin:0;font-size:22px;letter-spacing:-.01em;text-wrap:balance}p.sub{margin:4px 0 0;color:var(--mu)}
nav{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
.tab{border:1px solid var(--bd);background:var(--card);color:var(--fg);border-radius:999px;padding:8px 14px;font:inherit;cursor:pointer;min-width:0}.tab:focus-visible{outline:2px solid var(--ac);outline-offset:2px}.tab[aria-selected="true"]{background:var(--ac);color:var(--ac-fg);border-color:var(--ac)}
.stage{border:1px solid var(--bd);border-radius:14px;overflow:hidden;background:var(--card);transform-origin:0 0}
</style>
<h1>${esc(project)}</h1><p class="sub">${frames.length} frame${frames.length === 1 ? '' : 's'} from Swift Canvas</p>
<nav role="tablist" aria-label="Frames">${tabs}</nav>
<main>${panes}</main>
<script>
(function(){var tabs=[].slice.call(document.querySelectorAll('.tab')),panes=[].slice.call(document.querySelectorAll('.pane'));
panes.forEach(function(p){var host=p.querySelector('.frame'),t=p.querySelector('template');try{var root=host.attachShadow({mode:'open'});root.appendChild(t.content.cloneNode(true))}catch(e){host.textContent='This frame cannot be shown here.'}});
function fit(){var w0=document.body.clientWidth-32;panes.forEach(function(p){if(p.hidden)return;var w=+p.dataset.w,h=+p.dataset.h,s=Math.min(1,w0/w),st=p.querySelector('.stage');st.style.width=w+'px';st.style.height=h+'px';st.style.transform='scale('+s+')';p.style.height=Math.round(h*s)+'px'})}
tabs.forEach(function(t,i){t.addEventListener('click',function(){tabs.forEach(function(x,j){x.setAttribute('aria-selected',String(j===i));panes[j].hidden=j!==i});fit()})});addEventListener('resize',fit);fit()})();
</script>`;
  const html = opts.standalone ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0}img{max-width:100%}</style></head><body>${body}</body></html>` : body;
  const bytes = new TextEncoder().encode(html).length; if (bytes > MAX_PAGE_BYTES) return { ok: false, error: `the page is ${(bytes / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_PAGE_BYTES / 1024 / 1024} MB (pick fewer or lighter frames)` };
  return { ok: true, html, bytes, frames: frames.length };
}
const KEY = (project: string): string => `swift-canvas.artifact.v1.${project}`;
export type ArtifactRec = { url: string; at: number };
/** The artifact this project was last published as (its URL, so the next publish updates it in place). Only a claude.ai link is accepted. */
export function loadArtifact(project: string): ArtifactRec | null { try { const o = JSON.parse(localStorage.getItem(KEY(project)) ?? 'null') as Partial<ArtifactRec> | null; return o && typeof o.url === 'string' && isArtifactUrl(o.url) && typeof o.at === 'number' ? { url: o.url, at: o.at } : null; } catch { return null; } }
export const isArtifactUrl = (u: string): boolean => { try { const x = new URL(u); return x.protocol === 'https:' && x.hostname === 'claude.ai' && /^\/(code\/)?artifact\//.test(x.pathname); } catch { return false; } };
export function saveArtifact(project: string, url: string): string | null { if (!isArtifactUrl(url)) return 'not a claude.ai artifact link'; try { localStorage.setItem(KEY(project), JSON.stringify({ url, at: Date.now() })); return null; } catch (e) { return e instanceof Error ? e.message : 'save failed'; } }
