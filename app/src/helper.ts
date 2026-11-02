// Client for the local helper: an authenticated WebSocket on 127.0.0.1. The helper checks the Origin and the token (see helper/src/lib.rs).
import type { SayEvent, SayTransport } from './say/say';
export const HELPER_PORT = 7431;
export type HelperState = { status: 'connecting' | 'connected' | 'offline'; claude?: string; version?: string };
export type ScanResult = { ok: true; scan: { files: number; tokens: { name: string; value: string; file: string }[]; colors: { value: string; count: number }[]; fonts: { value: string; count: number }[] } } | { ok: false; error: string };
export type HelperConnection = { close: () => void; say: SayTransport; prewarm: () => void; scan: (path: string) => Promise<ScanResult> };
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
  const pending = new Map<string, (e: SayEvent) => void>(); const scans = new Map<string, (r: ScanResult) => void>();
  const failAll = (text: string) => { for (const [, cb] of pending) cb({ kind: 'error', text }); pending.clear(); for (const [, cb] of scans) cb({ ok: false, error: text }); scans.clear(); };
  const open = () => {
    onState({ status: 'connecting' }); ws = new WebSocket(helperUrl(token));
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return; const h = parseHello(e.data); if (h) { onState(h); return; }
      const sc = parseScanReply(e.data); if (sc) { const cb = scans.get(sc.id); scans.delete(sc.id); cb?.(sc.result); return; }
      const s = parseSayEvent(e.data); if (!s) return; const cb = pending.get(s.id); if (!cb) return; if (s.event.kind !== 'delta') pending.delete(s.id); cb(s.event);
    };
    ws.onclose = () => { onState({ status: 'offline' }); failAll('helper disconnected'); if (!stop) timer = setTimeout(open, 2000); };
    ws.onerror = () => ws?.close();
  };
  open();
  return {
    close: () => { stop = true; if (timer) clearTimeout(timer); ws?.close(); },
    scan: (path) => new Promise<ScanResult>((resolve) => { if (!ws || ws.readyState !== WebSocket.OPEN) return resolve({ ok: false, error: 'helper offline' }); const id = `p${++n}`; const t = setTimeout(() => { scans.delete(id); resolve({ ok: false, error: 'scan timed out' }); }, 15000); scans.set(id, (r) => { clearTimeout(t); resolve(r); }); ws.send(JSON.stringify({ type: 'project.scan', id, path })); }),
    prewarm: () => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'prewarm' })); },
    say: (system, request, onEvent) => { if (!ws || ws.readyState !== WebSocket.OPEN) return onEvent({ kind: 'error', text: 'helper offline' }); const id = `s${++n}`; pending.set(id, onEvent); ws.send(JSON.stringify({ type: 'say', id, system, request })); },
  };
}
