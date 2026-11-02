// Client for the local helper: an authenticated WebSocket on 127.0.0.1. The helper checks the Origin and the token (see helper/src/lib.rs).
import type { SayEvent, SayTransport } from './say/say';
export const HELPER_PORT = 7431;
export type HelperState = { status: 'connecting' | 'connected' | 'offline'; claude?: string; version?: string };
export type ScanResult = { ok: true; scan: { files: number; tokens: { name: string; value: string; file: string }[]; colors: { value: string; count: number }[]; fonts: { value: string; count: number }[] } } | { ok: false; error: string };
export type StoreResult = { ok: true; data: string | null } | { ok: false; error: string };
export type PickResult = { ok: true; path: string } | { ok: false; error: string };
export function parsePickReply(data: string): { id: string; result: PickResult } | null {
  try { const m = JSON.parse(data) as { type?: string; id?: string; ok?: boolean; path?: unknown; error?: string }; if (m.type !== 'project.pick' || typeof m.id !== 'string') return null; return { id: m.id, result: m.ok === true && typeof m.path === 'string' ? { ok: true, path: m.path } : { ok: false, error: m.error ?? 'no folder chosen' } }; } catch { return null; }
}
export type HelperConnection = { close: () => void; say: SayTransport; prewarm: () => void; scan: (path: string) => Promise<ScanResult>; storePut: (project: string, data: string) => Promise<StoreResult>; pickFolder: () => Promise<PickResult>; storeGet: (project: string) => Promise<StoreResult> };
export function parseStoreReply(data: string): { id: string; result: StoreResult } | null {
  try { const m = JSON.parse(data) as { type?: string; id?: string; ok?: boolean; data?: unknown; error?: string }; if ((m.type !== 'store.put' && m.type !== 'store.get') || typeof m.id !== 'string') return null; return { id: m.id, result: m.ok === true ? { ok: true, data: typeof m.data === 'string' ? m.data : null } : { ok: false, error: m.error ?? 'store failed' } }; } catch { return null; }
}
export function parseScanReply(data: string): { id: string; result: ScanResult } | null {
  try { const m = JSON.parse(data) as { type?: string; id?: string; ok?: boolean; scan?: unknown; error?: string }; if (m.type !== 'project.scan' || typeof m.id !== 'string') return null; return { id: m.id, result: m.ok === true ? ({ ok: true, scan: m.scan } as ScanResult) : { ok: false, error: m.error ?? 'scan failed' } }; } catch { return null; }
}
export function helperUrl(token: string, port = HELPER_PORT): string { return `ws://127.0.0.1:${port}/?token=${encodeURIComponent(token)}`; }
export function parseHello(data: string): HelperState | null {
  try { const m = JSON.parse(data) as { type?: string; claude?: string; version?: string }; return m.type === 'hello' ? { status: 'connected', ...(m.claude !== undefined ? { claude: m.claude } : {}), ...(m.version !== undefined ? { version: m.version } : {}) } : null; } catch { return null; }
}
export function parseSayEvent(data: string): { id: string; event: SayEvent } | null {
  try { const m = JSON.parse(data) as { type?: string; id?: string; kind?: string; text?: string }; if (m.type !== 'say.event' || typeof m.id !== 'string') return null;
    if (m.kind === 'delta') return { id: m.id, event: { kind: 'delta', text: m.text ?? '' } }; if (m.kind === 'done') return { id: m.id, event: { kind: 'done' } }; if (m.kind === 'error') return { id: m.id, event: { kind: 'error', text: m.text ?? 'error' } }; return null; } catch { return null; }
}
export function connectHelper(token: string, onState: (s: HelperState) => void): HelperConnection {
  let ws: WebSocket | null = null; let stop = false; let timer: ReturnType<typeof setTimeout> | undefined; let n = 0;
  const pending = new Map<string, (e: SayEvent) => void>(); const scans = new Map<string, (r: ScanResult) => void>(); const stores = new Map<string, (r: StoreResult) => void>(); const picks = new Map<string, (r: PickResult) => void>();
  const failAll = (text: string) => { for (const [, cb] of pending) cb({ kind: 'error', text }); pending.clear(); for (const [, cb] of scans) cb({ ok: false, error: text }); scans.clear(); for (const [, cb] of stores) cb({ ok: false, error: text }); stores.clear(); for (const [, cb] of picks) cb({ ok: false, error: text }); picks.clear(); };
  const open = () => {
    onState({ status: 'connecting' }); ws = new WebSocket(helperUrl(token));
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return; const h = parseHello(e.data); if (h) { onState(h); return; }
      const pk = parsePickReply(e.data); if (pk) { const cb = picks.get(pk.id); picks.delete(pk.id); cb?.(pk.result); return; }
      const st = parseStoreReply(e.data); if (st) { const cb = stores.get(st.id); stores.delete(st.id); cb?.(st.result); return; }
      const sc = parseScanReply(e.data); if (sc) { const cb = scans.get(sc.id); scans.delete(sc.id); cb?.(sc.result); return; }
      const s = parseSayEvent(e.data); if (!s) return; const cb = pending.get(s.id); if (!cb) return; if (s.event.kind !== 'delta') pending.delete(s.id); cb(s.event);
    };
    ws.onclose = () => { onState({ status: 'offline' }); failAll('helper disconnected'); if (!stop) timer = setTimeout(open, 2000); };
    ws.onerror = () => ws?.close();
  };
  const storeCall = (type: 'store.put' | 'store.get', project: string, data?: string) => new Promise<StoreResult>((resolve) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return resolve({ ok: false, error: 'helper offline' });
    const id = `t${++n}`; const timer2 = setTimeout(() => { stores.delete(id); resolve({ ok: false, error: 'helper did not answer' }); }, 8000); stores.set(id, (r) => { clearTimeout(timer2); resolve(r); });
    ws.send(JSON.stringify({ type, id, project, ...(data !== undefined ? { data } : {}) }));
  });
  open();
  return {
    close: () => { stop = true; if (timer) clearTimeout(timer); ws?.close(); },
    scan: (path) => new Promise<ScanResult>((resolve) => { if (!ws || ws.readyState !== WebSocket.OPEN) return resolve({ ok: false, error: 'helper offline' }); const id = `p${++n}`; const t = setTimeout(() => { scans.delete(id); resolve({ ok: false, error: 'scan timed out' }); }, 15000); scans.set(id, (r) => { clearTimeout(t); resolve(r); }); ws.send(JSON.stringify({ type: 'project.scan', id, path })); }),
    pickFolder: () => new Promise<PickResult>((resolve) => { if (!ws || ws.readyState !== WebSocket.OPEN) return resolve({ ok: false, error: 'helper offline' }); const id = `k${++n}`; picks.set(id, resolve); ws.send(JSON.stringify({ type: 'project.pick', id })); }), // the user may take as long as they like
    storePut: (project, data) => storeCall('store.put', project, data), storeGet: (project) => storeCall('store.get', project),
    prewarm: () => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'prewarm' })); },
    say: (system, request, onEvent) => { if (!ws || ws.readyState !== WebSocket.OPEN) return onEvent({ kind: 'error', text: 'helper offline' }); const id = `s${++n}`; pending.set(id, onEvent); ws.send(JSON.stringify({ type: 'say', id, system, request })); },
  };
}
