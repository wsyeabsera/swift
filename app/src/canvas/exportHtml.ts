const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A standalone HTML file for one frame: the frame's current markup in a page of its own size. */
export function exportDoc(title: string, html: string): string {
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${esc(title)}</title>\n<style>html,body{margin:0;background:#000}</style>\n</head>\n<body>\n${html}\n</body>\n</html>\n`;
}
/** A safe file name from a frame title: letters, digits and dashes, never empty. */
export function exportName(title: string): string { const s = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50); return `${s || 'frame'}.html`; }
