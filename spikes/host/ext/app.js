const out = { }; window.__results = out;
const add = new Uint8Array([0,97,115,109,1,0,0,0,1,7,1,96,2,127,127,1,127,3,2,1,0,7,7,1,3,97,100,100,0,0,10,9,1,7,0,32,0,32,1,106,11]);
async function run(cfg) {
  try { const { instance } = await WebAssembly.instantiate(add); out.wasm = instance.exports.add(2, 3) === 5 ? 'ok' : 'wrong'; } catch (e) { out.wasm = 'FAIL ' + e.message; }
  const f = document.getElementById('f'); await new Promise(r => f.addEventListener('load', r));
  const wait = (pred) => new Promise(res => { const h = e => { if (pred(e.data)) { removeEventListener('message', h); res(e.data); } }; addEventListener('message', h); });
  f.contentWindow.postMessage({ t: 'hello' }, '*'); out.sandboxFrame = await wait(d => d.t === 'info');
  try { void f.contentDocument.body; out.parentCanReadFrameDom = f.contentDocument !== null; } catch (e) { out.parentCanReadFrameDom = false; }
  const lat = []; for (let i = 0; i < 50; i++) { const t = performance.now(); f.contentWindow.postMessage({ t: 'ping', id: i }, '*'); await wait(d => d.t === 'pong' && d.id === i); lat.push(performance.now() - t); }
  lat.sort((a, b) => a - b); out.postMessageRoundTripMs = { p50: +lat[25].toFixed(2), p95: +lat[47].toFixed(2) };
  out.promptApi = typeof LanguageModel === 'undefined' ? 'absent' : await LanguageModel.availability().catch(e => 'error ' + e.message);
  out.hasFileSystemAccess = typeof showDirectoryPicker === 'function';
  try { const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1/*' }); const tab = tabs.find(t => t.url.includes(cfg.pagePort)); const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => { const cs = getComputedStyle(document.body); return { bg: cs.backgroundColor, font: cs.fontFamily, nodes: document.querySelectorAll('*').length }; } }); out.capture = r.result; } catch (e) { out.capture = 'FAIL ' + e.message; }
  await new Promise(res => { const t0 = performance.now(); let n = 0, maxGap = 0, last = t0; const ws = new WebSocket(`ws://127.0.0.1:${cfg.wsPort}/?token=${cfg.token}`);
    ws.onmessage = () => { n++; const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; };
    ws.onclose = () => { out.helperStream = { messages: n, seconds: +((performance.now() - t0) / 1000).toFixed(1), maxGapMs: Math.round(maxGap) }; res(); };
    ws.onerror = () => { out.helperStream = out.helperStream || 'error'; }; });
  out.done = true;
}
window.startSpike = run;
