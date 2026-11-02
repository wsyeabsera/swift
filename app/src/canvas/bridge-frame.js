// Runs INSIDE each frame (sandboxed, opaque origin). Single source: inlined into srcdoc for the dev page, copied to extension/frame.js for the extension's sandbox page.
addEventListener('message', (e) => {
  if (e.source !== parent) return; const m = e.data; if (!m || typeof m.rid !== 'number') return;
  const reply = (o) => parent.postMessage(Object.assign({ t: 'reply', rid: m.rid }, o), '*');
  try {
    if (m.t === 'load') { document.body.innerHTML = String(m.html); reply({ ok: true }); }
    else if (m.t === 'edit') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); el.style.setProperty(m.prop, m.value); reply({ ok: true }); }
    else if (m.t === 'get') { const el = document.getElementById(m.el); if (!el) return reply({ ok: false }); reply({ ok: true, value: getComputedStyle(el).getPropertyValue(m.prop) }); }
    else if (m.t === 'hit') { const el = document.elementFromPoint(m.x, m.y); let n = el; while (n && !n.id) n = n.parentElement; reply({ ok: true, id: n ? n.id : null }); }
  } catch (err) { reply({ ok: false }); }
});
