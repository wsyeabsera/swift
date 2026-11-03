// Runs INSIDE each frame (sandboxed, opaque origin). Single source: inlined into srcdoc for the dev page, copied to extension/frame.js for the extension's sandbox page.
addEventListener('message', (e) => {
  if (e.source !== parent) return; const m = e.data; if (!m || typeof m.rid !== 'number') return;
  const reply = (o) => parent.postMessage(Object.assign({ t: 'reply', rid: m.rid }, o), '*');
  try {
    if (m.t === 'load') { document.body.innerHTML = String(m.html); reply({ ok: true }); }
    else if (m.t === 'edit') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); const before = el.style.getPropertyValue(m.prop); el.style.setProperty(m.prop, m.value); reply({ ok: true, before }); }
    else if (m.t === 'get') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); reply({ ok: true, value: getComputedStyle(el).getPropertyValue(m.prop) }); }
    else if (m.t === 'snapshot') { reply({ ok: true, html: document.body.innerHTML }); }
    else if (m.t === 'styled') { // a PORTABLE copy of an element: its computed look inlined on every node (the page's CSS rules do not travel), colours that equal a brand token written as var(--token, colour)
      const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); const probe = document.createElement('span'); document.body.appendChild(probe); const norm = (v) => { probe.style.color = ''; probe.style.color = v; return probe.style.color ? getComputedStyle(probe).color : ''; };
      const byColour = {}; for (const [name, v] of Object.entries(m.tokens || {})) { const c = norm(String(v)); if (c && c !== 'rgba(0, 0, 0, 0)' && !(c in byColour)) byColour[c] = name; }
      const COLOUR = new Set(['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color']);
      const PROPS = ['color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-decoration-line', 'display', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'gap', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'border-radius', 'box-shadow', 'opacity', 'width', 'height', 'white-space', 'overflow'];
      const SKIP = new Set(['none', 'normal', 'auto', '0px', 'rgba(0, 0, 0, 0)', 'start', 'visible', '1', 'nowrap', 'row', 'stretch', 'baseline']); const clone = el.cloneNode(true); const a = [el, ...el.querySelectorAll('*')], b = [clone, ...clone.querySelectorAll('*')];
      a.forEach((n, i) => { const cs = getComputedStyle(n); const decl = []; for (const p of PROPS) { const v = cs.getPropertyValue(p); if (!v || SKIP.has(v) || (p.startsWith('border-') && p.endsWith('-color') && cs.getPropertyValue(p.replace('-color', '-style')) === 'none')) continue; decl.push(p + ':' + (COLOUR.has(p) && byColour[v] ? 'var(' + byColour[v] + ', ' + v + ')' : v)); } b[i].removeAttribute('class'); b[i].setAttribute('style', decl.join(';')); });
      probe.remove(); reply({ ok: true, html: clone.outerHTML }); }
    else if (m.t === 'outer') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); reply({ ok: true, html: el.outerHTML }); }
    else if (m.t === 'text') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); const before = el.textContent; el.textContent = String(m.value); reply({ ok: true, before }); }
    else if (m.t === 'add') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); el.insertAdjacentHTML('beforeend', String(m.html)); reply({ ok: true }); }
    else if (m.t === 'remove') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); el.remove(); reply({ ok: true }); }
    else if (m.t === 'rect') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); const r = el.getBoundingClientRect(); reply({ ok: true, rect: { x: r.left, y: r.top, w: r.width, h: r.height } }); }
    else if (m.t === 'props') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); const cs = getComputedStyle(el); const values = {}; for (const p of m.props) values[p] = cs.getPropertyValue(p); reply({ ok: true, values }); }
    else if (m.t === 'tree') { const out = []; const walk = (n, parent, depth) => { for (const c of n.children) { if (c.id) { out.push({ id: c.id, parent, depth, tag: c.tagName.toLowerCase(), hidden: c.style.visibility === 'hidden', text: c.children.length ? '' : (c.textContent || '').trim().slice(0, 24) }); walk(c, c.id, depth + 1); } else walk(c, parent, depth); } }; walk(document.body, null, 0); reply({ ok: true, tree: out }); }
    else if (m.t === 'hit') { const el = document.elementFromPoint(m.x, m.y); let n = el; while (n && !n.id) n = n.parentElement; reply({ ok: true, id: n ? n.id : null }); }
  } catch (err) { reply({ ok: false }); }
});
