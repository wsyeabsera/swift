// Client for the local helper: an authenticated WebSocket on 127.0.0.1. The helper checks the Origin and the token (see helper/src/lib.rs).
import type { SayEvent, SayTransport } from './say/say';
export const HELPER_PORT = 7431;
export type HelperState = { status: 'connecting' | 'connected' | 'offline'; claude?: string; version?: string };
export type HelperConnection = { close: () => void; say: SayTransport };
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
  const pending = new Map<string, (e: SayEvent) => void>();
  const failAll = (text: string) => { for (const [, cb] of pending) cb({ kind: 'error', text }); pending.clear(); };
  const open = () => {
    onState({ status: 'connecting' }); ws = new WebSocket(helperUrl(token));
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return; const h = parseHello(e.data); if (h) { onState(h); return; }
      const s = parseSayEvent(e.data); if (!s) return; const cb = pending.get(s.id); if (!cb) return; if (s.event.kind !== 'delta') pending.delete(s.id); cb(s.event);
    };
    ws.onclose = () => { onState({ status: 'offline' }); failAll('helper disconnected'); if (!stop) timer = setTimeout(open, 2000); };
    ws.onerror = () => ws?.close();
  };
  open();
  return {
    close: () => { stop = true; if (timer) clearTimeout(timer); ws?.close(); },
    say: (system, request, onEvent) => { if (!ws || ws.readyState !== WebSocket.OPEN) return onEvent({ kind: 'error', text: 'helper offline' }); const id = `s${++n}`; pending.set(id, onEvent); ws.send(JSON.stringify({ type: 'say', id, system, request })); },
  };
}
