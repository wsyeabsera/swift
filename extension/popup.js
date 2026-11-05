// Toolbar popup (task #1844): recent projects, command bar, lenses. Every row opens the app with a hash that app/src/entry.ts reads.
const LENSES = ['Design', 'Prototype', 'Motion', 'Effects', '3D', 'Critique', 'Pulse', 'Brand', 'Diagram']; // keep in step with LENSES in app/src/App.tsx (extension/popup.test checks it)
const url = (h) => chrome.runtime.getURL('app/index.html') + (h ? '#' + h : '');
const open = (h) => { chrome.tabs.create({ url: url(h) }); window.close(); };
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const reg = read('swift-canvas.projects.v1'); const names = new Map(((reg && reg.list) || []).map((p) => [p.id, p.name]));
const ids = (read('swift-canvas.recent-projects.v1') || []).filter((id) => names.has(id)).slice(0, 5);
if (!ids.length && reg && reg.active && names.has(reg.active)) ids.push(reg.active);
const ul = document.getElementById('recent');
for (const id of ids) { const li = document.createElement('li'); const b = document.createElement('button'); b.textContent = names.get(id); b.onclick = () => open('project=' + id); li.append(b); ul.append(li); }
if (!ids.length) { const li = document.createElement('li'); li.className = 'mu'; li.textContent = 'No projects yet.'; ul.append(li); }
LENSES.forEach((l, i) => { const b = document.createElement('button'); b.textContent = l; b.setAttribute('aria-keyshortcuts', String(i + 1)); b.title = l + ' (' + (i + 1) + ')'; b.onclick = () => open('lens=' + (i + 1)); const n = document.createElement('span'); n.className = 'mu'; n.textContent = String(i + 1); n.setAttribute('aria-hidden', 'true'); b.append(n); document.getElementById('lenses').append(b); });
document.getElementById('cmd').onclick = () => open('say=1');
document.getElementById('new').onclick = () => open('say=1'); // templates arrive with #1832/#1834; until then Say starts a new design
document.getElementById('panel').onclick = async () => { const w = await chrome.windows.getCurrent(); await chrome.sidePanel.open({ windowId: w.id }); window.close(); };
document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open('say=1'); } else if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) open('lens=' + e.key); });
document.getElementById('cmd').focus();
