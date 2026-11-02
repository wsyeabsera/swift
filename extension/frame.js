// Runs INSIDE each frame (sandboxed, opaque origin). Single source: inlined into srcdoc for the dev page, copied to extension/frame.js for the extension's sandbox page.
addEventListener('message', (e) => {
  if (e.source !== parent) return; const m = e.data; if (!m || typeof m.rid !== 'number') return;
  const reply = (o) => parent.postMessage(Object.assign({ t: 'reply', rid: m.rid }, o), '*');
  try {
    if (m.t === 'load') { document.body.innerHTML = String(m.html); reply({ ok: true }); }
    else if (m.t === 'edit') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); const before = el.style.getPropertyValue(m.prop); el.style.setProperty(m.prop, m.value); reply({ ok: true, before }); }
    else if (m.t === 'get') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); reply({ ok: true, value: getComputedStyle(el).getPropertyValue(m.prop) }); }
    else if (m.t === 'snapshot') { reply({ ok: true, html: document.body.innerHTML }); }
    else if (m.t === 'outer') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); reply({ ok: true, html: el.outerHTML }); }
    else if (m.t === 'text') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); const before = el.textContent; el.textContent = String(m.value); reply({ ok: true, before }); }
    else if (m.t === 'add') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); el.insertAdjacentHTML('beforeend', String(m.html)); reply({ ok: true }); }
    else if (m.t === 'remove') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); el.remove(); reply({ ok: true }); }
    else if (m.t === 'rect') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); const r = el.getBoundingClientRect(); reply({ ok: true, rect: { x: r.left, y: r.top, w: r.width, h: r.height } }); }
    else if (m.t === 'props') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); const cs = getComputedStyle(el); const values = {}; for (const p of m.props) values[p] = cs.getPropertyValue(p); reply({ ok: true, values }); }
    else if (m.t === 'tree') { const out = []; const walk = (n, parent, depth) => { for (const c of n.children) { if (c.id) { out.push({ id: c.id, parent, depth, tag: c.tagName.toLowerCase(), text: c.children.length ? '' : (c.textContent || '').trim().slice(0, 24) }); walk(c, c.id, depth + 1); } else walk(c, parent, depth); } }; walk(document.body, null, 0); reply({ ok: true, tree: out }); }
    else if (m.t === 'hit') { const el = document.elementFromPoint(m.x, m.y); let n = el; while (n && !n.id) n = n.parentElement; reply({ ok: true, id: n ? n.id : null }); }
  } catch (err) { reply({ ok: false }); }
});
