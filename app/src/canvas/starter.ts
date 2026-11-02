import type { FrameDef } from './fixtures';
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const find = (tokens: Record<string, string>, names: string[]): string | null => { for (const n of names) { const k = Object.keys(tokens).find((t) => t.toLowerCase() === `--${n}`); if (k) return k; } return null; };
/** A first screen for a new project, painted with ITS tokens (background, text, accent, card, border) so it starts on-brand. Tokens become CSS variables on the root; the elements use var(...) with a plain fallback. */
export function starterFrames(name: string, tokens: Record<string, string>): FrameDef[] {
  const bg = find(tokens, ['bg', 'background', 'base', 'surface', 'canvas']); const fg = find(tokens, ['fg', 'text', 'ink', 'foreground']); const ac = find(tokens, ['accent', 'primary', 'ac', 'brand']);
  const acFg = find(tokens, ['accent-fg', 'primary-fg']); const muted = find(tokens, ['muted-fg', 'muted', 'faint']); const card = find(tokens, ['card', 'surface-2', 'panel']); const line = find(tokens, ['border', 'line', 'stroke']);
  const v = (k: string | null, fallback: string) => (k ? `var(${k})` : fallback);
  const decl = Object.entries(tokens).slice(0, 16).map(([k, val]) => `${k}:${val}`).join(';');
  const html = `<div id="screen" style="${decl};position:relative;width:1280px;height:800px;overflow:hidden;font-family:system-ui;color:${v(fg, '#f5f5f7')};background:${v(bg, '#14151a')}">`
    + `<div id="title" style="position:absolute;left:80px;top:80px;font-size:56px;font-weight:600">${esc(name)}</div>`
    + `<div id="subtitle" style="position:absolute;left:80px;top:170px;font-size:24px;color:${v(muted, 'inherit')};opacity:${muted ? 1 : 0.6}">Say what you want here.</div>`
    + `<div id="card" style="position:absolute;left:80px;top:260px;width:520px;padding:28px;border-radius:20px;background:${v(card, 'rgba(255,255,255,0.06)')};border:1px solid ${v(line, 'rgba(255,255,255,0.12)')}"><div id="card-t" style="font-size:28px;font-weight:600">First card</div><div id="card-m" style="margin-top:8px;font-size:18px;color:${v(muted, 'inherit')}">Styled with this project's own tokens.</div></div>`
    + `<div id="cta" style="position:absolute;left:80px;top:470px;padding:16px 28px;border-radius:14px;font-size:20px;font-weight:600;background:${v(ac, '#0a84ff')};color:${v(acFg, '#fff')}">Primary action</div>`
    + `</div>`;
  return [{ id: 'screen', root: 'screen', title: 'Screen 1280×800', x: 0, y: 0, w: 1280, h: 800, html }];
}
