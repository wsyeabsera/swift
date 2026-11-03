/** A captured page (the helper's rendered, script-free DOM) becomes ONE frame: the body turns into a root div, `html`/`body` rules follow it, and every element gets an id so it can be selected and edited. */
export const CAPTURE_ROOT = 'page';
const SKIP = new Set(['style', 'script', 'link', 'meta', 'title', 'head', 'html', 'body', 'br', 'wbr', 'noscript', 'template']);
/** Add an id to every element that lacks one (outside <style>); ids are stable in document order: n1, n2, … */
export function assignIds(html: string): string {
  let n = 0; const used = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1]!));
  const parts = html.split(/(<style[\s\S]*?<\/style>)/i);
  return parts.map((part) => (/^<style/i.test(part) ? part : part.replace(/<([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^>]*?)?)(\/?)>/g, (m, tag: string, attrs: string, selfClose: string) => {
    if (SKIP.has(tag.toLowerCase()) || /\sid=["']/.test(attrs)) return m; let id = ''; do id = `n${++n}`; while (used.has(id)); used.add(id); return `<${tag} id="${id}"${attrs}${selfClose}>`;
  }))).join('');
}
const bodyOf = (html: string): { inner: string; attrs: string } => { const m = /<body([^>]*)>([\s\S]*?)<\/body>/i.exec(html); return m ? { attrs: m[1] ?? '', inner: m[2] ?? '' } : { attrs: '', inner: html }; };
const attrOf = (attrs: string, name: string): string => new RegExp(`\\s${name}=["']([^"']*)["']`, 'i').exec(attrs)?.[1] ?? '';
/** Selectors `html`, `body` and `:root` in captured CSS now mean the frame root. */
export function retargetRoot(css: string): string { return css.replace(/(^|[}\s,{>+~])(html|body)(?=[\s,{.:#[>+~]|$)/gi, `$1#${CAPTURE_ROOT}`); }
export function captureToFrame(html: string, size: { w: number; h: number } = { w: 1280, h: 800 }, fullPage = false): { html: string; root: string; w: number; h: number } {
  const styles = [...html.matchAll(/<style[\s\S]*?<\/style>/gi)].map((m) => retargetRoot(m[0])).join(''); const { inner, attrs } = bodyOf(html.replace(/<style[\s\S]*?<\/style>/gi, ''));
  const cls = attrOf(attrs, 'class'), st = attrOf(attrs, 'style'); const bare = inner.replace(/<script[\s\S]*?<\/script>/gi, '');
  const root = `<div id="${CAPTURE_ROOT}"${cls ? ` class="${cls}"` : ''} style="${st ? `${st};` : ''}position:relative;width:${size.w}px;${fullPage ? `min-height:${size.h}px` : `height:${size.h}px;overflow:hidden`};box-sizing:border-box">${styles}${bare}</div>`;
  return { html: assignIds(root), root: CAPTURE_ROOT, ...size };
}

/** Brand tokens a captured page declares: custom properties on :root / html / body in its stylesheets (later declarations win). Validation happens in toBrandTokens. */
export function pageTokens(html: string): { name: string; value: string }[] {
  const found = new Map<string, string>();
  for (const style of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) for (const rule of (style[1] ?? '').matchAll(/(?:^|[}\s,])(?::root|html|body)\s*(?:,[^{]*)?\{([^}]*)\}/g)) for (const d of (rule[1] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) found.set(d[1]!, d[2]!.trim());
  return [...found].map(([name, value]) => ({ name, value }));
}
